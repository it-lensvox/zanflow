import json
import boto3
from django.conf import settings

def generate_title_from_content(content):
    """
    Uses AWS Bedrock (Amazon Nova) to generate a short title based on the note's content.
    """
    if not content or len(content.strip()) < 5:
        return "Untitled Note"

    try:
        client = boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )

        prompt = f"Read the following note content and generate a short, catchy title (maximum 4 words). Reply ONLY with the title, no quotes, no extra text.\n\nContent: {content}"

        # Payload formatted specifically for Amazon Nova models
        body = json.dumps({
            "schemaVersion": "messages-v1",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "inferenceConfig": {
                "maxTokens": 20,
                "temperature": 0.5
            }
        })

        response = client.invoke_model(
            modelId=settings.BEDROCK_MODEL_ID, 
            body=body,
            accept='application/json',
            contentType='application/json'
        )

        # Parse the Nova response structure
        response_body = json.loads(response.get('body').read())
        generated_title = response_body["output"]["message"]["content"][0]["text"].strip(' "\'\n')
        
        return generated_title

    except Exception as e:
        print(f"Bedrock AI Title Generation Failed: {e}")
        return "Untitled Note"