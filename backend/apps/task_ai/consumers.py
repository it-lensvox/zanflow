import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .services import TaskAIService

class AIBotConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Authenticate the user here if needed
        self.user = self.scope.get("user")
        
        await self.accept()
        # Optional: Send a welcome message upon connection
        await self.send(text_data=json.dumps({
            "type": "system",
            "text": "ZanFlow AI connected."
        }))

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        user_message = data.get("message")
        context_data = data.get("context", {})
        chat_history = data.get("history", [])

        if not user_message:
            return

        # --- NEW: AUTO-TITLE GENERATION ---
        # If history is empty, this is the very first message of a new chat
        if len(chat_history) == 0:
            # Generate the title asynchronously
            chat_title = await sync_to_async(TaskAIService.generate_chat_title)(user_message)
            
            # Send a special WebSocket message to the frontend to update the chat name
            await self.send(text_data=json.dumps({
                "type": "chat_title",
                "text": chat_title
            }))
            
            # (Optional) If you have a Chat model in your database, you would update its title here!
            # await sync_to_async(update_chat_db_title)(chat_id, chat_title)
        # ----------------------------------

        # 1. Fetch the database context asynchronously
        system_context = await sync_to_async(TaskAIService.get_page_context)(self.user, context_data)

        # 2. Initialize the generator
        stream_generator = TaskAIService.generate_chat_stream(
            user_message, system_context, chat_history, self.user
        )

        # 3. Create a helper function to safely grab the next chunk
        def get_next_chunk():
            try:
                return next(stream_generator)
            except StopIteration:
                return None

        # 4. Loop through the stream by executing the `next()` step safely in a sync thread
        while True:
            chunk = await sync_to_async(get_next_chunk)()
            
            if chunk is None:
                break # Stream is finished
                
            await self.send(text_data=json.dumps({
                "type": "ai_chunk",
                "text": chunk
            }))
            
        # 5. Notify frontend that the stream is finished
        await self.send(text_data=json.dumps({
            "type": "ai_complete",
            "text": ""
        }))