//index.ts
// Message type definition
export interface Message {
    id: string;
    room_id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
    image?: string;
    document?: string;
  }
  
  // Room type definition
  export interface Room {
    room_id: number;
    room_name?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: number;
  }
  
  // API Response types
  export interface ApiResponse<T> {
    data: T;
    message?: string;
    status?: string;
  }
  
  export interface MessagesResponse {
    messages: Message[];
    total?: number;
    page?: number;
    limit?: number;
  }
  
  export interface RoomsResponse {
    data: Room[];
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  }
  
  export interface CreateRoomResponse {
    room_id: number;
    room_name?: string;
    created_at?: string;
  }
  
  export interface BotResponse {
    text: string;
    image?: string;
    document?: string;
  }
  
  export interface MessagePairResponse {
    user: {
      text: string;
    };
    bot: BotResponse;
    response?: string; // Fallback for different API response formats
  }
  
  // API Service parameters
  export interface GetRoomsParams {
    page?: number;
    limit?: number;
    user_id?: number;
  }
  
  export interface UpdateRoomParams {
    name?: string;
    room_name?: string;
  }
  
  // Error types
  export interface ApiError {
    message: string;
    status?: number;
    code?: string;
  }