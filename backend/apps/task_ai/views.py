from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
from apps.projects.models import Project
from .services import TaskAIService, CalendarAgentService
import json
from datetime import date
from apps.users.auth import StaticTokenAuthentication

class SuggestTaskAIView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        project_id = request.data.get('project_id')
        user_description = request.data.get('description')

        if not project_id or not user_description:
            return Response(
                {"detail": "Project ID and description are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        project = get_object_or_404(Project, id=project_id)

        # 1. Get context from S3
        context = TaskAIService.get_project_context_from_s3(project)

        # 2. Get all project members with their skills (excluding admins)
        members_with_skills = TaskAIService.get_project_members_with_skills(project)
        
        if not members_with_skills:
            return Response(
                {"detail": "No eligible team members found in this project (excluding admins)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Get AI suggestion with intelligent assignment
        ai_response_raw = TaskAIService.generate_task_data_with_assignment(
            context, 
            user_description, 
            members_with_skills
        )
        
        if not ai_response_raw:
            return Response(
                {"detail": "AI generation failed"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            ai_data = json.loads(ai_response_raw)
        except json.JSONDecodeError as e:
            print(f"Failed to parse AI response: {e}")
            return Response(
                {"detail": "AI response parsing failed"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 4. Validate and sanitize assigned_to
        assigned_to = ai_data.get("assigned_to", [])
        
        # Ensure assigned members are valid and not admins
        valid_member_ids = [m['id'] for m in members_with_skills]
        assigned_to = [uid for uid in assigned_to if uid in valid_member_ids]
        
        # Fallback if AI didn't assign anyone
        if not assigned_to:
            # Detect task category from description for fallback
            desc_lower = user_description.lower()
            if any(word in desc_lower for word in ['react', 'vue', 'angular', 'frontend', 'ui', 'css']):
                category = 'frontend'
            elif any(word in desc_lower for word in ['django', 'python', 'database', 'backend', 'api']):
                category = 'backend'
            else:
                category = 'general'
            
            assigned_to = TaskAIService.fallback_assignment(members_with_skills, category)

        # 5. Format the response for your UI
        response_data = {
            "heading": ai_data.get("heading", "New Task"),
            "description": ai_data.get("description", user_description),
            "start_date": date.today().isoformat(),
            "end_date": ai_data.get("end_date", date.today().isoformat()),
            "assigned_to": assigned_to,
            "project": project.id,
            "status": "pending",
            "priority": ai_data.get("priority", "medium"),
            # Additional metadata for frontend display (optional)
            "ai_metadata": {
                "required_skills": ai_data.get("required_skills", []),
                "assignment_reasoning": ai_data.get("assignment_reasoning", "")
            }
        }

        return Response(response_data, status=status.HTTP_200_OK)
class RefineTaskTextView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('text')
        # 'optimize_title', 'generate_description', or 'refine_description'
        refine_type = request.data.get('type') 

        if not text or not refine_type:
            return Response(
                {"detail": "Text and type are required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        refined_text = TaskAIService.refine_text(text, refine_type)
        
        return Response({"refined_text": refined_text}, status=status.HTTP_200_OK)
    
class DyuksaChatAgentView(APIView):
    """
    Dedicated endpoint for the Dyuksa AI bot to prevent mixing AI logic 
    with standard chat/thread logic.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        
        if not message:
            return Response(
                {"detail": "Message is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Intercept the AI Trigger
        if message.lower().startswith("dyuksa "):
            # Strip the trigger word to pass only the intent to Bedrock
            intent_string = message[7:].strip() 
            
            # 2. Call the Bedrock Agent Service
            result = CalendarAgentService.process_scheduling_intent(
                user=request.user, 
                prompt_text=intent_string
            )
            
            # 3. Format the successful tool execution
            if "available_slots" in result:
                # Grab the first 5 slots to keep the chat message concise
                slots_str = ", ".join(result['available_slots'][:5]) 
                reply = f"I checked the schedules for {', '.join(result['attendees_found'])} on {result['date']}. Here are a few available {result['duration']}-minute slots: {slots_str}."
                
                return Response({"reply": reply}, status=status.HTTP_200_OK)
            
            # 4. Handle tool failure or missing users
            return Response(
                {"reply": result.get('error', "I couldn't determine the scheduling details. Could you clarify who and when?")}, 
                status=status.HTTP_200_OK 
            )

        # If it doesn't start with 'dyuksa', it shouldn't hit this endpoint ideally, 
        # but we handle it gracefully just in case.
        return Response(
            {"reply": "Standard message ignored by AI."}, 
            status=status.HTTP_200_OK
        )