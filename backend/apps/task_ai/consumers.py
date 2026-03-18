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
        chat_history = data.get("history", [])

        if not user_message:
            return

        if len(chat_history) == 0:
            chat_title = await sync_to_async(TaskAIService.generate_chat_title)(user_message)
            await self.send(text_data=json.dumps({
                "type": "chat_title",
                "text": chat_title
            }))

        # REMOVED the sync_to_async(TaskAIService.get_page_context) call completely!

        # 2. Initialize the generator (removed system_context parameter)
        stream_generator = TaskAIService.generate_chat_stream(
            user_message=user_message, 
            chat_history=chat_history, 
            user=self.user
        )

        # 3. Stream loop remains exactly the same
        def get_next_chunk():
            try:
                return next(stream_generator)
            except StopIteration:
                return None

        while True:
            chunk = await sync_to_async(get_next_chunk)()
            if chunk is None:
                break
            await self.send(text_data=json.dumps({"type": "ai_chunk", "text": chunk}))
            
        await self.send(text_data=json.dumps({"type": "ai_complete", "text": ""}))