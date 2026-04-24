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
        result_text += "Here is a sample of the first 5 for context:\n"
        
        for task in tasks[:5]: 
            project_name = task.project.name if task.project else "No Project"
            result_text += (
                f"- Task: '{task.heading}' (Project: {project_name}) | Status: {task.status} | Priority: {task.priority}\n"
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
    def generate_chat_stream(user_message, chat_history=None, user=None):
        if chat_history is None:
            chat_history = []

        client = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )

        prompt = """You are the Dyuksa ERP AI Assistant. 
        CRITICAL RULES:
        1. Answer directly and concisely. DO NOT narrate your actions.
        2. You have NO direct access to the user's screen or data. 
        3. You MUST use your tools to fetch real-time database information.
        4. When a tool returns a "Total Count", use that exact number in your response.
        """

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
                        "description": "Use this tool to find out how many projects the user is enrolled in.",
                        "inputSchema": {
                            "json": {
                                "type": "object",
                                "properties": {}
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
            
            # Print for debugging (you can remove this later)
            print(f"\nRAW BEDROCK OUTPUT: {json.dumps(output_message, indent=2)}\n")
            
            # --- THE FIX: Iterate correctly looking for 'toolUse' ---
            for content_block in output_message['content']:
                if 'toolUse' in content_block:
                    tool_use = content_block['toolUse']
                    if tool_use['name'] == 'check_calendar_availability':
                        args = tool_use['input']
                        
                        # Call the deterministic Python logic using standard integer IDs
                        result = CalendarAgentService.execute_phase_1_logic(
                            requesting_user=user,
                            names=args['attendee_names'],
                            date_str=args['target_date'],
                            duration=args['duration_minutes']
                        )
                        
                        CalendarAgentService.log_ai_interaction(user, prompt_text, response, result)
                        return result

        except Exception as e:
            logger.error(f"Bedrock API Error: {str(e)}")
            return {"error": "There was an issue connecting to the AI service."}

        return {"message": "I couldn't determine the scheduling details. Could you clarify who and when?"}

    @staticmethod
    def execute_phase_1_logic(requesting_user, names, date_str, duration):
        attendee_ids = [requesting_user.id]
        unfound_names = []
        
        for name in names:
            colleague = User.objects.filter(first_name__iexact=name).first() 
            if colleague:
                attendee_ids.append(colleague.id) 
            else:
                unfound_names.append(name)
                
        if unfound_names:
            return {"error": f"Could not find users: {', '.join(unfound_names)}"}

        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        day_start = timezone.make_aware(datetime.combine(target_date, datetime.strptime("09:00", "%H:%M").time()))
        day_end = timezone.make_aware(datetime.combine(target_date, datetime.strptime("18:00", "%H:%M").time()))

        events = Event.objects.filter(
            start_time__date=target_date,
            attendees__id__in=attendee_ids
        ).distinct()
        
        busy_intervals = [(e.start_time, e.end_time) for e in events]
        slots = find_available_slots(busy_intervals, day_start, day_end, duration)
        
        formatted_slots = [slot.strftime("%I:%M %p") for slot in slots]
        
        return {
            "attendees_found": names,
            "date": date_str,
            "duration": duration,
            "available_slots": formatted_slots
        }

    @staticmethod
    def log_ai_interaction(user, prompt, bedrock_raw, final_result):
        log_data = {
            "user": user.username,
            "prompt": prompt,
            "tool_triggered": "available_slots" in final_result,
            "final_result": final_result
        }
        logger.debug(f"AI Calendar Agent Interaction: {json.dumps(log_data, indent=2)}")