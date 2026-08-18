import boto3
import requests
import json
import logging
from django.conf import settings
from datetime import date, datetime, timedelta
import io
import PyPDF2
from apps.projects.models import Project
from apps.tasksite.models import Task
from apps.daily_updates.models import Event
from apps.daily_updates.utils import find_available_slots
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q

logger = logging.getLogger('apps')
User = get_user_model()

class TaskAIService:
    @staticmethod
    def get_project_context_from_s3(project):
        s3 = boto3.client('s3')
        bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        prefix = f"projects/{project.id}/documents/"
        context_text = f"Project Name: {project.name}\n"
        
        try:
            response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
            if 'Contents' not in response:
                return context_text

            for obj in response['Contents']:
                file_key = obj['Key']
                file_obj = s3.get_object(Bucket=bucket_name, Key=file_key)
                file_content = file_obj['Body'].read()

                # Handle PDF files specifically
                if file_key.lower().endswith('.pdf'):
                    pdf_file = io.BytesIO(file_content)
                    reader = PyPDF2.PdfReader(pdf_file)
                    for page in reader.pages:
                        context_text += page.extract_text() + "\n"
                
                # Handle standard text files
                elif file_key.lower().endswith('.txt'):
                    context_text += file_content.decode('utf-8') + "\n"

        except Exception as e:
            print(f"Error processing S3 file: {e}")
            
        return context_text[:4000]

    @staticmethod
    def get_project_members_with_skills(project):
        """
        Get all project members including admins/managers/users with their skills metadata.
        """
        members_data = []
        
        # Get all members from the project
        for member in project.members.all():
            member_info = {
                'id': member.id,
                'username': member.username,
                'email': member.email,
                'role': member.role,
                'skills': []
            }
            
            # Get skills for this member
            if hasattr(member, 'skills') and member.skills:
                if isinstance(member.skills, str):
                    try:
                        member_info['skills'] = json.loads(member.skills)
                    except json.JSONDecodeError:
                        member_info['skills'] = []
                elif isinstance(member.skills, list):
                    member_info['skills'] = member.skills
                else:
                    member_info['skills'] = [
                        {
                            'name': skill.name,
                            'proficiency': skill.proficiency,
                            'category': skill.category
                        } for skill in member.skills.all()
                    ]
            
            members_data.append(member_info)
        
        return members_data

    @staticmethod
    def generate_task_data_with_assignment(project_context, user_description, members_with_skills):
        client = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        model_id = settings.BEDROCK_MODEL_ID
        
        # Format members data for the prompt
        members_summary = []
        for member in members_with_skills:
            formatted_skills = []
            for s in member['skills']:
                if isinstance(s, dict):
                    name = s.get('name', 'Unknown')
                    prof = s.get('proficiency', 'N/A')
                    formatted_skills.append(f"{name} ({prof})")
                elif isinstance(s, str):
                    formatted_skills.append(s)
                else:
                    formatted_skills.append(str(s))
                    
            skills_text = ", ".join(formatted_skills)

            members_summary.append(
                f"- {member['username']} (Role: {member['role']}, ID: {member['id']}): {skills_text}"
            )
        members_text = "\n".join(members_summary)
        
        prompt = f"""
You are a professional project manager with expertise in task assignment.
Analyze the Project Context, Task Intent, and Team Members' skills provided below.

Project Context: {project_context}
User Task Intent: {user_description}
Today's Date: {date.today().isoformat()}

Available Team Members:
{members_text}

ASSIGNMENT RULES (CRITICAL):
1. Analyze the task description to identify required skills.
2. MONITORING REQUIREMENT (MANDATORY):
   - If a member with Role 'admin' exists in the list, they MUST be assigned (for monitoring purposes).
   - If NO 'admin' exists, you MUST assign a member with Role 'manager'.
3. WORKFORCE ASSIGNMENT:
   - In addition to the Admin/Manager, assign 1-2 'user' role members who best match the required skills.
   - Consider proficiency levels: Expert > Advanced > Intermediate > Beginner.
4. Total assigned members should be the Monitor (Admin/Manager) + Workers (Users).

Return ONLY a FLAT JSON object with this exact schema:

{{
    "heading": "String (Short, descriptive task title)",
    "description": "String (Detailed plain text explanation of the task)",
    "end_date": "YYYY-MM-DD (realistic completion date based on task complexity)",
    "priority": "low | medium | high | critical",
    "assigned_to": [list of user IDs including the mandatory Admin or Manager],
    "required_skills": ["skill1", "skill2"],
    "assignment_reasoning": "Brief explanation of why these members were chosen"
}}
"""
        user_message = f"""
        Project Context: {project_context}
        User Intent: {user_description}
        Available Members:
        {members_text}

        Return JSON with: heading, description, end_date (YYYY-MM-DD), priority, assigned_to (list of IDs), required_skills, assignment_reasoning.
        """

        native_request = {
            "system": [{"text": prompt}],
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": user_message}]
                }
            ],
            "inferenceConfig": {
                "maxTokens": 1024,
                "temperature": 0.1,
            }
        }

        try:
            response = client.invoke_model(
                modelId=model_id,
                body=json.dumps(native_request)
            )
            
            response_body = json.loads(response["body"].read())
            raw_text = response_body["output"]["message"]["content"][0]["text"]

            if "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]

            return raw_text.strip().strip('"') 
            
        except Exception as e:
            print(f"Error calling AWS Bedrock: {e}")
            return raw_text  

    @staticmethod
    def execute_project_search(user):
        """
        Retrieves the list and count of projects the current user is enrolled in.
        """
        if not user or not user.is_authenticated:
            return "Error: User is not authenticated."
            
        from apps.projects.models import Project
        
        projects = Project.objects.filter(members=user)
        count = projects.count()
        
        if count == 0:
            return "You are currently not enrolled in any projects."
            
        result_text = f"You are enrolled in {count} projects:\n"
        for project in projects:
            result_text += f"- {project.name}\n"
            
        return result_text


    @staticmethod
    def execute_project_details(user, project_name):
        """
        Returns full details about a specific project: description, status,
        all tasks with assignees, and all members. Used by the AI bot when
        the user asks about a specific project by name.
        """
        if not user or not user.is_authenticated:
            return "Error: User is not authenticated."

        from apps.projects.models import Project, ProjectMembership

        # Find project by name (case-insensitive, user must be a member)
        try:
            project = Project.objects.filter(
                members=user,
                name__icontains=project_name.strip()
            ).first()
        except Exception:
            project = None

        if not project:
            # Try without membership filter in case name matches exactly
            project = Project.objects.filter(name__icontains=project_name.strip()).first()

        if not project:
            return f"DATABASE RESULT: No project named '{project_name}' was found."

        now = timezone.now()

        # Tasks
        all_tasks = Task.objects.filter(project=project).prefetch_related('assigned_to')
        total      = all_tasks.count()
        pending    = all_tasks.filter(status='pending').count()
        in_progress = all_tasks.filter(status='in_progress').count()
        completed  = all_tasks.filter(status='completed').count()
        overdue    = sum(
            1 for t in all_tasks.exclude(status='completed')
            if getattr(t, 'end_date', None) and t.end_date < now
        )

        result = (
            f"DATABASE RESULT: Full details for project '{project.name}'\n"
            f"Status: {getattr(project, 'status', 'Unknown')}\n"
            f"Description: {getattr(project, 'description', 'No description') or 'No description'}\n"
            f"\nTask Summary:\n"
            f"  Total: {total} | Pending: {pending} | In Progress: {in_progress} | "
            f"Completed: {completed} | Overdue: {overdue}\n"
            f"\nALL TASKS:\n"
        )

        for task in all_tasks:
            assignees = ", ".join(u.get_full_name() or u.username for u in task.assigned_to.all()) or "Unassigned"
            due = getattr(task, 'end_date', None)
            due_str = due.strftime('%Y-%m-%d') if due else 'No due date'
            result += (
                f"  - [#{task.id}] '{task.heading}' | Status: {task.status} | "
                f"Priority: {task.priority} | Assigned to: {assignees} | Due: {due_str}\n"
            )

        # Members
        result += "\nPROJECT MEMBERS:\n"
        try:
            for pm in ProjectMembership.objects.filter(project=project).select_related('user'):
                u = pm.user
                result += (
                    f"  - {u.get_full_name() or u.username} | Username: {u.username} | "
                    f"ID: {u.id} | Role: {getattr(pm, 'role', 'member')}\n"
                )
        except Exception:
            for u in project.members.all():
                result += f"  - {u.get_full_name() or u.username} | Username: {u.username} | ID: {u.id}\n"

        return result


    @staticmethod
    def execute_event_search(user, date_filter=None, upcoming=False):
        """
        Search events the user is attending or has created.
        date_filter: 'today', 'tomorrow', 'this_week', or None (returns next 14 days)
        """
        if not user or not user.is_authenticated:
            return "Error: User is not authenticated."

        from django.db.models import Q
        now = timezone.now()
        today = now.date()

        base_qs = Event.objects.filter(
            Q(attendees=user) | Q(organizer=user)
        ).distinct().order_by('start_time')

        # Apply date filter
        if date_filter == 'today':
            events = base_qs.filter(start_time__date=today)
            label = "today"
        elif date_filter == 'tomorrow':
            tomorrow = today + timedelta(days=1)
            events = base_qs.filter(start_time__date=tomorrow)
            label = "tomorrow"
        elif date_filter == 'this_week':
            week_end = today + timedelta(days=7)
            events = base_qs.filter(start_time__date__gte=today, start_time__date__lte=week_end)
            label = "this week"
        else:
            # Default: upcoming 14 days
            two_weeks = today + timedelta(days=14)
            events = base_qs.filter(start_time__date__gte=today, start_time__date__lte=two_weeks)
            label = "in the next 14 days"

        total = events.count()

        if total == 0:
            return f"DATABASE RESULT: You have 0 events scheduled {label}."

        result = f"DATABASE RESULT: You have {total} event(s) scheduled {label}. Here they are:\n"
        for ev in events:
            start_str = ev.start_time.strftime('%Y-%m-%d %H:%M') if ev.start_time else 'Unknown'
            end_str   = ev.end_time.strftime('%H:%M') if ev.end_time else 'Unknown'
            attendees = ", ".join(
                u.get_full_name() or u.username
                for u in ev.attendees.exclude(id=user.id)
            ) or "No other attendees"
            result += (
                f"  - '{ev.title}' | Type: {getattr(ev, 'event_type', 'Event')} | "
                f"Date: {start_str} - {end_str} | With: {attendees}\n"
            )

        return result

    @staticmethod
    def fallback_assignment(members_with_skills, task_category='general'):
        """
        Fallback logic if AI assignment fails.
        """
        users = [m for m in members_with_skills if m['role'] == 'user']
        managers = [m for m in members_with_skills if m['role'] == 'manager']
        admins = [m for m in members_with_skills if m['role'] == 'admin']
        
        matching_members = []
        
        if admins:
            matching_members.append(admins[0]['id'])
        elif managers:
            matching_members.append(managers[0]['id'])
            
        if task_category in ['frontend', 'backend']:
            for member in users:
                has_skill = any(
                    skill['category'].lower() == task_category.lower()
                    for skill in member['skills']
                )
                if has_skill:
                    matching_members.append(member['id'])
                    if len(matching_members) >= 3:
                        break
        
        if len(matching_members) == 1 and users:
             matching_members.append(users[0]['id'])
        
        return matching_members if matching_members else []
    
    @staticmethod
    def refine_text(text, task_type):
        """
        Refines task title or description using Amazon Bedrock.
        """
        client = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )

        prompts = {
            'optimize_title': f"Professionalize this task title while keeping it concise: '{text}'. Return only the new title.",
            'generate_description': f"Write a detailed, professional project task description for the title: '{text}'. Use bullet points for clarity.",
            'refine_description': f"Improve this task description for clarity and professionalism: '{text}'. Keep the original meaning but enhance the tone."
        }

        system_instruction = "You are a professional project manager. Return ONLY the refined text without any conversational filler."

        native_request = {
            "system": [{"text": system_instruction}],
            "messages": [{"role": "user", "content": [{"text": prompts[task_type]}]}],
            "inferenceConfig": {"maxTokens": 1024, "temperature": 0.3}
        }

        try:
            response = client.invoke_model(
                modelId=settings.BEDROCK_MODEL_ID,
                body=json.dumps(native_request)
            )
            response_body = json.loads(response["body"].read())
            raw_text = response_body["output"]["message"]["content"][0]["text"]

            cleaned_text = raw_text.replace("###", "").replace("**", "")
            return cleaned_text.strip().strip('"')
            
        except Exception as e:
            print(f"Error refining text: {e}")
            return text

    @staticmethod
    def execute_global_task_search(user, priority=None, status=None, username=None, date_filter=None):
        if not user or not user.is_authenticated:
            return "Error: User is not authenticated."

        tasks = Task.objects.all().select_related('project').prefetch_related('assigned_to')

        if username:
            try:
                from apps.users.models import User
                target_user = User.objects.get(username__iexact=username)
                tasks = tasks.filter(assigned_to=target_user)
            except User.DoesNotExist:
                return f"I couldn't find a user named '{username}' in the system."
        else:
            tasks = tasks.filter(assigned_to=user)

        if priority:
            tasks = tasks.filter(priority=priority.lower())
        if status:
            tasks = tasks.filter(status=status.lower())
            
        if date_filter == 'today':
            from django.utils import timezone
            today = timezone.now().date()
            tasks = tasks.filter(end_date__date=today)

        total_count = tasks.count()

        if total_count == 0:
            return "DATABASE RESULT: 0 tasks found matching that criteria."

        result_text = f"DATABASE RESULT: There are exactly {total_count} tasks matching this criteria.\n"
        result_text += f"ALL {total_count} tasks listed below:\n"
        
        for task in tasks:
            project_name = task.project.name if task.project else "No Project"
            due_date = getattr(task, 'end_date', None)
            due_str = due_date.strftime('%Y-%m-%d') if due_date else 'No due date'
            assignees = ", ".join([u.username for u in task.assigned_to.all()]) or "Unassigned"
            result_text += (
                f"- [#{task.id}] '{task.heading}' | Project: {project_name} | "
                f"Status: {task.status} | Priority: {task.priority} | "
                f"Assigned to: {assignees} | Due: {due_str}\n"
            )
            
        return result_text
    
    @staticmethod
    def get_page_context(user, context_data):
        page = context_data.get("page", "dashboard")
        page_id = context_data.get("id", None)
        
        context_text = f"The user is currently on the {page.capitalize()} page.\n\n"

        try:
            if page == "taskboard" and page_id:
                project = Project.objects.get(id=page_id)
                context_text += f"Project Name: {project.name}\n"
                
                tasks = Task.objects.filter(project=project).prefetch_related('assigned_to')
                
                context_text += f"Total Tasks in Project: {tasks.count()}\n"
                context_text += "Current Tasks:\n"
                
                for task in tasks:
                    assignees = ", ".join([u.username for u in task.assigned_to.all()])
                    if not assignees:
                        assignees = "Unassigned"
                        
                    due_date = task.end_date.strftime('%Y-%m-%d') if task.end_date else "No due date"
                    
                    context_text += (
                        f"- Task: '{task.heading}' | Status: {task.status} | "
                        f"Priority: {task.priority} | Assigned to: {assignees} | Due: {due_date}\n"
                    )

            elif page == "dashboard":
                context_text += "Here is the user's current personalized data:\n"
                
                if user and user.is_authenticated:
                    active_tasks = Task.objects.filter(
                        assigned_to=user,
                        status__in=['pending', 'in_progress', 'review']
                    ).select_related('project').order_by('end_date')[:10] 
                    
                    context_text += f"User's Active Tasks: {active_tasks.count()}\n"
                    
                    for task in active_tasks:
                        project_name = task.project.name if task.project else "No Project"
                        due_date = task.end_date.strftime('%Y-%m-%d') if task.end_date else "No due date"
                        
                        context_text += (
                            f"- [{project_name}] Task: '{task.heading}' | Status: {task.status} | "
                            f"Priority: {task.priority} | Due: {due_date}\n"
                        )
                elif page == "calendar":
                    context_text += "Here is the user's schedule data:\n"
                    
                    if user and user.is_authenticated:
                        today = timezone.now().date()
                        context_text += f"Today's Date is {today}.\n"
                        
                        todays_tasks = Task.objects.filter(
                            assigned_to=user,
                            end_date__date=today,
                            status__in=['pending', 'in_progress', 'review']
                        ).select_related('project')
                        
                        context_text += f"Total active tasks due today: {todays_tasks.count()}\n"
                        
                        if todays_tasks.exists():
                            for task in todays_tasks:
                                project_name = task.project.name if task.project else "No Project"
                                context_text += (
                                    f"- [{project_name}] Task: '{task.heading}' | "
                                    f"Status: {task.status} | Priority: {task.priority}\n"
                                )
                        
                else:
                    context_text += "User is not authenticated. Cannot load personal tasks.\n"

        except Project.DoesNotExist:
            context_text += f" (Note: Project with ID {page_id} could not be found).\n"
        except Exception as e:
            print(f"Error fetching context data: {e}")
            context_text += " (An error occurred while loading specific database records for this page).\n"
            
        return context_text

    @staticmethod
    def _extract_last_project_from_history(chat_history):
        """
        Scans chat history in reverse to find the most recently mentioned project name.
        Looks in both user messages and assistant replies.
        Returns the project name string or None.
        """
        if not chat_history:
            return None

        try:
            projects = list(
                Project.objects.values_list('name', flat=True)
            )
        except Exception:
            return None

        # Scan history newest-first
        for msg in reversed(chat_history):
            text = msg.get('text', '') or ''
            text_lower = text.lower()
            for project_name in projects:
                if project_name.lower() in text_lower:
                    return project_name

        return None


    @staticmethod
    def _resolve_project_name(raw_project_name, chat_history, user):
        """
        Reliably resolve what project the user is referring to.

        Strategy (in order of confidence):
        1. If raw_project_name matches a real project name in the DB → use it directly.
        2. If raw_project_name is vague (empty, or contains words like 'last', 'same',
           'that', 'the', 'it', 'this', 'current', 'discussed', 'project') →
           scan chat_history for the most recently mentioned real project name.
        3. If still nothing → return raw_project_name as-is so execute_project_details
           can return a clean "not found" message.
        """
        VAGUE_KEYWORDS = {
            'last', 'same', 'that', 'the', 'it', 'this', 'current',
            'discussed', 'project', 'mentioned', 'above', 'previous',
            'placeholder', 'context', 'recent', 'name'
        }

        # Step 1: Check if the AI gave us a real project name
        if raw_project_name:
            words = set(raw_project_name.lower().split())
            is_vague = words.issubset(VAGUE_KEYWORDS) or len(words) == 0
            
            if not is_vague:
                # Verify it actually exists in DB
                try:
                    exists = Project.objects.filter(
                        name__icontains=raw_project_name
                    ).exists()
                    if exists:
                        return raw_project_name
                except Exception:
                    pass

        # Step 2: Scan history for real project names
        from_history = TaskAIService._extract_last_project_from_history(chat_history)
        if from_history:
            return from_history

        # Step 3: Fall back — let execute_project_details handle the "not found" case
        return raw_project_name

    @staticmethod
    def generate_chat_stream(user_message, chat_history=None, user=None):
        if chat_history is None:
            chat_history = []

        client = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )

        # Detect the last project discussed in this conversation so the AI
        # can resolve follow-up references like "it", "that project", "the same one"
        last_project = TaskAIService._extract_last_project_from_history(chat_history)
        
        context_hint = ""
        if last_project:
            context_hint = (
                f"\n\nCONVERSATION CONTEXT:\n"
                f"The user has been discussing the project '{last_project}' in this conversation. "
                f"If the user refers to 'it', 'the project', 'that project', 'this project', "
                f"'the same project', or any vague reference to a project, "
                f"they almost certainly mean '{last_project}'. "
                f"Use '{last_project}' as the project_name in search_project_details "
                f"without asking the user to clarify."
            )

        prompt = """You are the Dyuksa ERP AI Assistant — a friendly, knowledgeable helper for the platform.

CRITICAL RULES:
1. Answer directly and concisely. DO NOT narrate your actions or say things like "I will now search...".
2. You have NO direct access to the user's data. You MUST use tools to get real database information.
3. When a tool returns a result, use the EXACT numbers and names from the result. Never guess or make up data.
4. When a tool returns "DATABASE RESULT: There are exactly N tasks", always use that exact number N in your reply.
5. ALWAYS show ALL tasks returned by the tool — never say "here are the first N" or truncate the list.
6. NEVER ask the user to repeat or clarify a project name if the CONVERSATION CONTEXT already identifies it.

TOOL USAGE GUIDE:
- User asks about a specific named project (explain, describe, tasks in, members of, who is manager): use search_project_details
- User uses "it", "the project", "that project", "same project", "how many members" without naming a project: check CONVERSATION CONTEXT for the last project, then use search_project_details with that name
- User asks about their tasks (pending, completed, by priority, by status): use search_global_tasks
- User asks how many projects they are in: use search_user_projects
- User asks about events, meetings, schedule, calendar ("events today", "meetings this week", "what's scheduled"): use search_events — NEVER use search_project_details for event questions
- User asks to create a task: explain you can create tasks — ask for the project name, task title, and priority
""" + context_hint

        formatted_messages = []
        for msg in chat_history:
            role = msg.get("role", "user") if msg.get("role") in ["user", "assistant"] else "user"
            formatted_messages.append({"role": role, "content": [{"text": msg.get("text", "")}]})
            
        formatted_messages.append({"role": "user", "content": [{"text": user_message}]})

        tool_config = {
            "tools": [
                {
                    "toolSpec": {
                        "name": "search_global_tasks",
                        "description": "Search for tasks. Use this when the user asks about pending, critical, or today's tasks.",
                        "inputSchema": {
                            "json": {
                                "type": "object",
                                "properties": {
                                    "priority": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                                    "status": {"type": "string", "enum": ["pending", "in_progress", "completed", "review"]},
                                    "username": {"type": "string", "description": "The username of the assignee."},
                                    "date_filter": {"type": "string", "enum": ["today"], "description": "Use 'today' if the user asks for tasks due today."}
                                }
                            }
                        }
                    }
                },
                {
                    "toolSpec": {
                        "name": "search_user_projects",
                        "description": "Use this tool to find out how many projects the user is enrolled in. Returns project names only.",
                        "inputSchema": {
                            "json": {
                                "type": "object",
                                "properties": {}
                            }
                        }
                    }
                },
                {
                    "toolSpec": {
                        "name": "search_project_details",
                        "description": "Use this tool when the user asks about a specific project by name — to get its full details: description, status, ALL tasks with assignees and due dates, and all members. Always use this tool when the user asks to 'explain', 'describe', 'summarise', or asks about tasks/members of a named project.",
                        "inputSchema": {
                            "json": {
                                "type": "object",
                                "properties": {
                                    "project_name": {
                                        "type": "string",
                                        "description": "The name (or partial name) of the project the user is asking about."
                                    }
                                },
                                "required": ["project_name"]
                            }
                        }
                    }
                },
                {
                    "toolSpec": {
                        "name": "search_events",
                        "description": "Use this tool when the user asks about their calendar events, meetings, or scheduled activities. Use it for questions like 'how many events today', 'what meetings do I have this week', 'any events tomorrow'. Do NOT use search_project_details for event questions.",
                        "inputSchema": {
                            "json": {
                                "type": "object",
                                "properties": {
                                    "date_filter": {
                                        "type": "string",
                                        "enum": ["today", "tomorrow", "this_week"],
                                        "description": "Use 'today' for today's events, 'tomorrow' for tomorrow, 'this_week' for next 7 days. Omit for all upcoming events in the next 14 days."
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        }

        response = client.converse(
            modelId=settings.BEDROCK_MODEL_ID,
            messages=formatted_messages,
            system=[{"text": prompt}],
            toolConfig=tool_config
        )

        output_message = response['output']['message']
        
        if output_message['content'] and 'toolUse' in output_message['content'][-1]:
            tool_use = output_message['content'][-1]['toolUse']
            tool_name = tool_use['name']
            tool_inputs = tool_use['input']
            tool_use_id = tool_use['toolUseId']

            print(f"\n=== AI IS USING TOOL: {tool_name} with args {tool_inputs} ===\n")

            if tool_name == "search_global_tasks":
                tool_result_text = TaskAIService.execute_global_task_search(
                    user=user, 
                    priority=tool_inputs.get("priority"), 
                    status=tool_inputs.get("status"),
                    username=tool_inputs.get("username"),
                    date_filter=tool_inputs.get("date_filter") 
                )
            elif tool_name == "search_user_projects":
                tool_result_text = TaskAIService.execute_project_search(user=user)
            elif tool_name == "search_project_details":
                # ── Resolve the project name reliably ────────────────────────
                # The AI sometimes passes vague strings like "last discussed project"
                # or "the project" when it can't resolve context from the prompt alone.
                # We intercept here and resolve it ourselves from actual history.
                raw_project_name = tool_inputs.get("project_name", "").strip()
                resolved_project_name = TaskAIService._resolve_project_name(
                    raw_project_name=raw_project_name,
                    chat_history=chat_history,
                    user=user,
                )
                print(f"=== Resolved project name: '{raw_project_name}' -> '{resolved_project_name}' ===")
                tool_result_text = TaskAIService.execute_project_details(
                    user=user,
                    project_name=resolved_project_name,
                )
            elif tool_name == "search_events":
                tool_result_text = TaskAIService.execute_event_search(
                    user=user,
                    date_filter=tool_inputs.get("date_filter"),
                )
            else:
                tool_result_text = "Tool not found."

            formatted_messages.append(output_message)
            formatted_messages.append({
                "role": "user",
                "content": [{"toolResult": {"toolUseId": tool_use_id, "content": [{"text": tool_result_text}]}}]
            })

            stream_response = client.converse_stream(
                modelId=settings.BEDROCK_MODEL_ID,
                messages=formatted_messages,
                system=[{"text": prompt}],
                toolConfig=tool_config
            )
            
            for chunk in stream_response['stream']:
                if 'contentBlockDelta' in chunk:
                    yield chunk['contentBlockDelta']['delta'].get('text', '')

        else:
            for content_block in output_message['content']:
                if 'text' in content_block:
                    yield content_block['text']

    @staticmethod
    def generate_chat_title(first_message):
        client = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )

        prompt = f"""
        Read the following user message and generate a short, descriptive title for the chat session.
        RULES:
        1. Maximum 4 words.
        2. Return ONLY the title text. No quotes, no periods, no introductory words.
        User Message: "{first_message}"
        """

        native_request = {
            "system": [{"text": "You are a helpful assistant that only outputs short titles."}],
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"maxTokens": 20, "temperature": 0.3} 
        }

        try:
            response = client.converse(
                modelId=settings.BEDROCK_MODEL_ID,
                messages=native_request["messages"],
                system=native_request["system"],
                inferenceConfig=native_request["inferenceConfig"]
            )
            
            raw_title = response['output']['message']['content'][0]['text']
            return raw_title.strip().strip('"').strip("'")
            
        except Exception as e:
            print(f"Error generating chat title: {e}")
            return "New Conversation"


class CalendarAgentService:
    """
    Dedicated AI Agent service for scheduling, keeping bot logic 
    separated from standard thread/chat processing.
    """
    
    @staticmethod
    def process_scheduling_intent(user, prompt_text):
        today_str = timezone.now().strftime("%Y-%m-%d")
        
        bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )

        # Added 'title' and 'event_type' to the AI tool schema
        tools = [
            {
                "toolSpec": {
                    "name": "check_calendar_availability",
                    "description": "Finds available meeting times between the current user and colleagues.",
                    "inputSchema": {
                        "json": {
                            "type": "object",
                            "properties": {
                                "attendee_names": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "List of first names of colleagues to meet with (e.g., ['Shifali', 'Nikhil'])"
                                },
                                "target_date": {
                                    "type": "string",
                                    "description": f"The specific date for the meeting in YYYY-MM-DD format. Today is {today_str}."
                                },
                                "duration_minutes": {
                                    "type": "integer",
                                    "description": "The duration of the meeting in minutes. Default to 30 if not specified."
                                },
                                "title": {
                                    "type": "string",
                                    "description": "A short, generated title for the event, e.g., 'Meeting with Shifali'"
                                },
                                "event_type": {
                                    "type": "string",
                                    "description": "The type of event, usually 'Meeting', 'Call', or 'Code Review'"
                                }
                            },
                            "required": ["attendee_names", "target_date", "duration_minutes"]
                        }
                    }
                }
            }
        ]

        system_prompt = "You are a helpful AI scheduling assistant for the Dyuksa platform. Extract scheduling details to use the calendar tool."
        messages = [{"role": "user", "content": [{"text": prompt_text}]}]
        
        try:
            response = bedrock_runtime.converse(
                modelId=settings.BEDROCK_MODEL_ID,
                messages=messages,
                system=[{"text": system_prompt}],
                toolConfig={"tools": tools}
            )

            output_message = response['output']['message']
            
            for content_block in output_message['content']:
                if 'toolUse' in content_block:
                    tool_use = content_block['toolUse']
                    if tool_use['name'] == 'check_calendar_availability':
                        args = tool_use['input']
                        
                        # Pass all arguments, including the new optional ones
                        result = CalendarAgentService.execute_phase_1_logic(
                            requesting_user=user,
                            names=args['attendee_names'],
                            date_str=args['target_date'],
                            duration=args['duration_minutes'],
                            title=args.get('title', ''),
                            event_type=args.get('event_type', 'Meeting')
                        )
                        
                        CalendarAgentService.log_ai_interaction(user, prompt_text, response, result)
                        return result

        except Exception as e:
            logger.error(f"Bedrock API Error: {str(e)}")
            return {"reply": "There was an issue connecting to the AI service."}

        return {"reply": "I couldn't determine the scheduling details. Could you clarify who and when?"}

    @staticmethod
    def execute_phase_1_logic(requesting_user, names, date_str, duration, title, event_type):
        attendee_ids = [requesting_user.id]
        attendee_full_names = [requesting_user.get_full_name() or requesting_user.username]
        unfound_names = []
        
        for name in names:
            name_parts = name.strip().split()
            colleague = None
            
            # If the AI provided a full name (e.g., "Shifali Gupta")
            if len(name_parts) >= 2:
                first_name_guess = name_parts[0]
                last_name_guess = name_parts[-1]
                
                colleague = User.objects.filter(
                    (Q(first_name__icontains=first_name_guess) & Q(last_name__icontains=last_name_guess)) |
                    Q(username__icontains=name.replace(" ", ""))
                ).first()
            
            # If it's a single name or the full name search failed, do a broad search
            if not colleague:
                broad_search = name_parts[0] 
                colleague = User.objects.filter(
                    Q(first_name__icontains=broad_search) | 
                    Q(last_name__icontains=broad_search) | 
                    Q(username__icontains=broad_search)
                ).first()
                
            if colleague:
                # --- THE FIX: Only append if they aren't already in the list! ---
                if colleague.id not in attendee_ids:
                    attendee_ids.append(colleague.id) 
                    attendee_full_names.append(colleague.get_full_name() or colleague.username)
            else:
                unfound_names.append(name)
                
        if unfound_names:
            return {"reply": f"Could not find users: {', '.join(unfound_names)}"}

        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        day_start = timezone.make_aware(datetime.combine(target_date, datetime.strptime("09:00", "%H:%M").time()))
        day_end = timezone.make_aware(datetime.combine(target_date, datetime.strptime("18:00", "%H:%M").time()))

        events = Event.objects.filter(
            start_time__date=target_date,
            attendees__id__in=attendee_ids
        ).distinct()
        
        busy_intervals = [(e.start_time, e.end_time) for e in events]
        slots = find_available_slots(busy_intervals, day_start, day_end, duration)
        
        # Format slots as ISO 8601 UTC strings for the frontend
        formatted_slots = [slot.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") for slot in slots]
        
        # Generate default title if AI didn't provide a good one
        final_title = title if title else f"Meeting with {', '.join(names)}"
        final_event_type = event_type if event_type else "Meeting"

        # Construct the exact dictionary structure Jyoti requested
        return {
            "action": "create_event",
            "data": {
                "event_type": final_event_type,
                "title": final_title,
                "attendee_ids": attendee_ids,
                "attendee_names": attendee_full_names,
                "target_date": date_str,
                "duration_minutes": duration,
                "available_slots": formatted_slots
            },
            "reply": f"I found available slots for a {final_event_type.lower()} with {', '.join(names)} on {date_str}."
        }

    @staticmethod
    def log_ai_interaction(user, prompt, bedrock_raw, final_result):
        log_data = {
            "user": user.username,
            "prompt": prompt,
            "tool_triggered": "action" in final_result,
            "final_result": final_result
        }
        # logger.debug(f"AI Calendar Agent Interaction: {json.dumps(log_data, indent=2)}")