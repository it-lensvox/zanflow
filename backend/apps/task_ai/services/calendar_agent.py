import json
import boto3
import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from apps.daily_updates.models import Event
from apps.daily_updates.utils import find_available_slots
from django.utils import timezone

# Initialize standard Django logger
logger = logging.getLogger('apps')

User = get_user_model()
bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
)

def process_scheduling_intent(user, prompt_text):
    """
    Acts as the AI agent to parse scheduling requests and trigger Phase 1 math.
    """
    today_str = timezone.now().strftime("%Y-%m-%d")
    
    # 1. Define the tool for Claude
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

    # 2. Call Bedrock to parse the intent
    system_prompt = "You are a helpful AI scheduling assistant for the Dyuksa platform. Extract scheduling details to use the calendar tool."
    
    messages = [{"role": "user", "content": [{"text": prompt_text}]}]
    
    try:
        # Send to Claude on Bedrock
        response = bedrock_runtime.converse(
            modelId=settings.BEDROCK_MODEL_ID,
            messages=messages,
            system=[{"text": system_prompt}],
            toolConfig={"tools": tools}
        )

        output_message = response['output']['message']
        
        # 3. Handle Tool Use (The model decided to call our Phase 1 logic)
        if 'toolCalls' in [list(c.keys())[0] for c in output_message['content']]:
            for content in output_message['content']:
                if 'toolUse' in content:
                    tool_use = content['toolUse']
                    if tool_use['name'] == 'check_calendar_availability':
                        args = tool_use['input']
                        
                        # 4. Execute the Python logic
                        result = execute_phase_1_logic(
                            requesting_user=user,
                            names=args['attendee_names'],
                            date_str=args['target_date'],
                            duration=args['duration_minutes']
                        )
                        
                        # 5. Log via standard Python logging instead of a DB model
                        log_ai_interaction(user, prompt_text, response, result)
                        
                        return result

    except Exception as e:
        logger.error(f"Bedrock API Error: {str(e)}")
        return {"error": "There was an issue connecting to the AI service."}

    # Fallback if no tool was used
    return {"message": "I couldn't determine the scheduling details. Could you clarify who and when?"}

def execute_phase_1_logic(requesting_user, names, date_str, duration):
    """
    Resolves names to integers and calls the deterministic Python logic.
    """
    # Resolve names to User IDs
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

    # Set up time window
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_start = timezone.make_aware(datetime.combine(target_date, datetime.strptime("09:00", "%H:%M").time()))
    day_end = timezone.make_aware(datetime.combine(target_date, datetime.strptime("18:00", "%H:%M").time()))

    # Fetch busy intervals
    events = Event.objects.filter(
        start_time__date=target_date,
        attendees__id__in=attendee_ids
    ).distinct()
    
    busy_intervals = [(e.start_time, e.end_time) for e in events]
    
    # Run the Phase 1 Math Engine
    slots = find_available_slots(busy_intervals, day_start, day_end, duration)
    
    formatted_slots = [slot.strftime("%I:%M %p") for slot in slots]
    
    return {
        "attendees_found": names,
        "date": date_str,
        "duration": duration,
        "available_slots": formatted_slots
    }

def log_ai_interaction(user, prompt, bedrock_raw, final_result):
    """
    Standard console logging for AI utility and outputs.
    """
    log_data = {
        "user": user.username,
        "prompt": prompt,
        "tool_triggered": "available_slots" in final_result,
        "final_result": final_result
    }
    logger.debug(f"AI Calendar Agent Interaction: {json.dumps(log_data, indent=2)}")