import boto3
import requests
import json
from django.conf import settings
from datetime import date
import io
import PyPDF2

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
            # REMOVED: The check that skipped admin users
            # if member.role == 'admin':
            #    continue
                
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
        # Initialize the client using settings.py values explicitly
        
        client = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        # Ensure your .env has BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
        model_id = settings.BEDROCK_MODEL_ID
        
        # Format members data for the prompt
        members_summary = []
        for member in members_with_skills:
            # --- FIX START: Handle both string and dict skills safely ---
            formatted_skills = []
            for s in member['skills']:
                if isinstance(s, dict):
                    # If skill is an object: {'name': 'Python', 'proficiency': 'Expert'}
                    name = s.get('name', 'Unknown')
                    prof = s.get('proficiency', 'N/A')
                    formatted_skills.append(f"{name} ({prof})")
                elif isinstance(s, str):
                    # If skill is just a string: "Python"
                    formatted_skills.append(s)
                else:
                    # Fallback for other types
                    formatted_skills.append(str(s))
                    
            skills_text = ", ".join(formatted_skills)
            # --- FIX END ---

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

                # 1. First, handle the markdown backticks (existing logic)
            if "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]

            # 2. ADD THIS: Strip extra double quotes from the start and end
            # This prevents the ""Text"" issue in your output
            return raw_text.strip().strip('"') 
            
        except Exception as e:
            print(f"Error calling AWS Bedrock: {e}")
            return raw_text  # Return original if AI fails

    @staticmethod
    def fallback_assignment(members_with_skills, task_category='general'):
        """
        Fallback logic if AI assignment fails.
        Enforces Admin -> Manager hierarchy for mandatory assignment.
        """
        users = [m for m in members_with_skills if m['role'] == 'user']
        managers = [m for m in members_with_skills if m['role'] == 'manager']
        admins = [m for m in members_with_skills if m['role'] == 'admin']
        
        matching_members = []
        
        # 1. Mandatory Monitor Assignment
        if admins:
            # If admin exists, they are mandatory
            matching_members.append(admins[0]['id'])
        elif managers:
            # If no admin, manager is mandatory
            matching_members.append(managers[0]['id'])
            
        # 2. Assign Worker (User) based on skills
        if task_category in ['frontend', 'backend']:
            for member in users:
                has_skill = any(
                    skill['category'].lower() == task_category.lower()
                    for skill in member['skills']
                )
                if has_skill:
                    matching_members.append(member['id'])
                    # We just need one or two workers + the monitor
                    if len(matching_members) >= 3:
                        break
        
        # 3. If no skilled user found, pick first available user
        if len(matching_members) == 1 and users:
             matching_members.append(users[0]['id'])
        
        return matching_members if matching_members else []
    @staticmethod
    def refine_text(text, task_type):
        """
        Refines task title or description using Amazon Bedrock.
        task_type: 'optimize_title' | 'generate_description' | 'refine_description'
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

            # --- UPDATED LOGIC TO REMOVE FORMATTING ---
            # Remove Markdown symbols like ### and **
            cleaned_text = raw_text.replace("###", "").replace("**", "")
            
            # Strip extra double quotes from start/end
            return cleaned_text.strip().strip('"')
            
        except Exception as e:
            print(f"Error refining text: {e}")
            return text