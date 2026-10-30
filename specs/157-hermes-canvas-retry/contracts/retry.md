# Retry Contract

POST /api/chat or /api/chat/requests derives initial ancestors from context/messages, dropping the trailing user follow-up. Newly created Hermes task retains it atomically. Each conversation_open receives this stored seed. Existing legacy task sends no seed. Preparation failure remains503/mayHaveExecuted:false with zero submit calls; uncertain submit remains202/unknown. Original nonce protections and post-I/O owner checks remain.
