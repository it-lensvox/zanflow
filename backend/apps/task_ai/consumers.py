import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .services import TaskAIService

class AIBotConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        # Server-side session memory — persists for the lifetime of this WebSocket
        # connection. Ensures follow-up questions always have history even if the
        # frontend forgets to send it.
        self.session_history = []
        
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "system",
            "text": "ZanFlow AI connected."
        }))

    async def disconnect(self, close_code):
        self.session_history = []

    async def receive(self, text_data):
        data = json.loads(text_data)
        user_message = data.get("message")

        if not user_message:
            return

        # Merge: prefer frontend history if sent (it may have more turns from a
        # previous session), otherwise fall back to our server-side session memory.
        frontend_history = data.get("history", [])
        if frontend_history:
            # Frontend sent history — use it and sync our session memory to match
            chat_history = frontend_history
            self.session_history = list(frontend_history)
        else:
            # Frontend sent nothing — use what we remembered on the server
            chat_history = self.session_history

        if len(chat_history) == 0:
            chat_title = await sync_to_async(TaskAIService.generate_chat_title)(user_message)
            await self.send(text_data=json.dumps({
                "type": "chat_title",
                "text": chat_title
            }))

        # Add the current user message to server-side history immediately
        self.session_history.append({"role": "user", "text": user_message})

        stream_generator = TaskAIService.generate_chat_stream(
            user_message=user_message, 
            chat_history=chat_history, 
            user=self.user
        )

        # Stream the AI reply chunk by chunk, collecting the full reply
        full_ai_reply = []

        def get_next_chunk():
            try:
                return next(stream_generator)
            except StopIteration:
                return None

        while True:
            chunk = await sync_to_async(get_next_chunk)()
            if chunk is None:
                break
            full_ai_reply.append(chunk)
            await self.send(text_data=json.dumps({"type": "ai_chunk", "text": chunk}))
            
        await self.send(text_data=json.dumps({"type": "ai_complete", "text": ""}))

        # Store the complete AI reply in server-side history so the next message
        # can resolve references like "it", "that project", "the same one"
        if full_ai_reply:
            self.session_history.append({
                "role": "assistant",
                "text": "".join(full_ai_reply)
            })
        
        # Keep session memory bounded to last 30 exchanges (60 messages)
        if len(self.session_history) > 60:
            self.session_history = self.session_history[-60:]