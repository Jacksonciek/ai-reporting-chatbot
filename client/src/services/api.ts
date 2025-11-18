// api.ts
import {
    ApiResponse,
    MessagesResponse,
    RoomsResponse,
    CreateRoomResponse,
    MessagePairResponse,
    GetRoomsParams,
    Room,
    Message
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; // Adjust as needed
const USER_ID = 1; // Hardcoded as per requirements

class ApiService {
    private async fetchWithErrorHandling<T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message ||
                    errorData.error ||
                    `HTTP error! status: ${response.status}`
                );
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getRooms(params: GetRoomsParams = {}): Promise<RoomsResponse> {
        const limit = params.limit || 10;
        const offset = 0;
        const url = `${BASE_URL}/api/rooms/${USER_ID}/messages?limit=${limit}&offset=${offset}`;

        try {
            console.log('Fetching rooms from:', url);
            const response = await this.fetchWithErrorHandling<any>(url);
            
            console.log('Rooms API Response:', response);
            
            if (response.data && Array.isArray(response.data)) {
                const rooms: Room[] = response.data.map((room: any) => ({
                    room_id: room.room_id,
                    room_name: room.room_name || 'New chat',
                    created_at: room.created_at,
                    updated_at: room.updated_at || room.created_at,
                    user_id: room.user_id || USER_ID
                }));

                return {
                    data: rooms,
                    total: response.total_count || rooms.length,
                    hasMore: (offset + limit) < (response.total_count || 0)
                };
            }

            return { data: [], total: 0, hasMore: false };
        } catch (error) {
            console.error('Failed to fetch rooms:', error);
            throw error;
        }
    }

    async createRoom(name?: string): Promise<CreateRoomResponse> {
        const url = `${BASE_URL}/api/new_room`;
        const body = {
            room_name: name || 'New chat',
            user_id: USER_ID
        };

        try {
            console.log('Creating new room with body:', body);
            const response = await this.fetchWithErrorHandling<any>(url, {
                method: 'POST',
                body: JSON.stringify(body),
            });

            console.log('Create room response:', response);

            return {
                room_id: response.room_id || Date.now(),
                room_name: name || 'New chat',
                created_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to create room:', error);
            throw error;
        }
    }

    async getMessages(roomId: string): Promise<MessagesResponse> {
        try {
            console.log('Fetching messages for room:', roomId);
            
            // Get message pairs from the user rooms endpoint
            const url = `${BASE_URL}/api/${USER_ID}/rooms?limit=50&offset=0`;
            console.log('Fetching message pairs from:', url);
            
            const response = await this.fetchWithErrorHandling<any>(url);
            
            console.log('Message pairs response:', response);

            const messages: Message[] = [];
            
            // Process message pairs if available
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((pair: any, index: number) => {
                    if (pair.user && pair.user.text) {
                        messages.push({
                            id: `user-${roomId}-${index}`,
                            room_id: roomId,
                            content: pair.user.text,
                            role: 'user',
                            created_at: new Date(Date.now() - (response.data.length - index) * 1000).toISOString(),
                        });
                    }

                    if (pair.bot && pair.bot.text) {
                        messages.push({
                            id: `bot-${roomId}-${index}`,
                            room_id: roomId,
                            content: pair.bot.text,
                            role: 'assistant',
                            created_at: new Date(Date.now() - (response.data.length - index - 0.5) * 1000).toISOString(),
                            image: pair.bot.image,
                            document: pair.bot.document,
                        });
                    }
                });
            }

            // Sort messages by created_at
            messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            console.log(`Processed ${messages.length} messages for room ${roomId}`);
            return { messages };
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            return { messages: [] };
        }
    }

    async sendMessageToBot(roomId: string, message: string): Promise<MessagePairResponse> {
        const url = `${BASE_URL}/api/rooms/${roomId}/messages/bot`;
        const body = {
            user_prompt: message,
            user_id: USER_ID
        };

        try {
            console.log('Sending message to bot in room:', roomId, 'Message:', message);
            
        const response = await this.fetchWithErrorHandling<any>(url, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        console.log('Bot response:', response);

        // Support different response shapes by normalizing the payload
        const botPayload = response.data ?? response.bot ?? {};
        const botText =
            botPayload?.text ||
            response.response ||
            response.message ||
            'No response received';
        const botImage =
            botPayload?.image ||
            botPayload?.image_url ||
            response.image ||
            response.image_url;
        const botDocument =
            botPayload?.document ||
            botPayload?.document_url ||
            response.document ||
            response.document_url;

        return {
            user: { text: message },
            bot: {
                text: botText,
                image: botImage,
                document: botDocument,
            },
            response: response.response || response.message,
        };
    } catch (error) {
            console.error('Failed to send message to bot:', error);
            return {
                user: { text: message },
                bot: {
                    text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                }
            };
        }
    }

    // Helper method to test connection
    async testConnection(): Promise<boolean> {
        try {
            await this.fetchWithErrorHandling(`${BASE_URL}/api/${USER_ID}/rooms`);
            return true;
        } catch {
            return false;
        }
    }
}

export const apiService = new ApiService();
