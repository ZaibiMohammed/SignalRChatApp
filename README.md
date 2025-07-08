# SignalR Chat Application - Technical Documentation

This document provides a technical overview of how SignalR is implemented in this real-time chat application, which consists of a .NET API backend and an Angular frontend.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [SignalR Implementation](#signalr-implementation)
  - [Backend Implementation](#backend-implementation)
  - [Frontend Implementation](#frontend-implementation)
- [Connection Lifecycle](#connection-lifecycle)
- [Message Broadcasting](#message-broadcasting)
- [Error Handling and Reconnection](#error-handling-and-reconnection)
- [CORS Configuration](#cors-configuration)
- [Running the Application](#running-the-application)

## Architecture Overview

The application follows a client-server architecture:

- **Backend**: ASP.NET Core API with SignalR Hub
- **Frontend**: Angular 17.3 SPA with SignalR client

The SignalR technology enables real-time, bidirectional communication between the server and connected clients. Unlike traditional HTTP request/response patterns, SignalR maintains a persistent connection that allows the server to push data to clients as it becomes available.

## SignalR Implementation

### Backend Implementation

The backend uses ASP.NET Core SignalR to create a hub that clients connect to:

#### ChatHub Class

Located in `SignalRChat.API/Hubs/ChatHub.cs`, this class extends `Hub` from the SignalR library:

```csharp
public class ChatHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}
```

This hub defines a `SendMessage` method that:
1. Receives user and message parameters from any client
2. Broadcasts the message to all connected clients using `Clients.All.SendAsync()`
3. Uses "ReceiveMessage" as the event name that clients listen for

#### Hub Registration

In `Program.cs`, the SignalR hub is registered and configured:

```csharp
// Add SignalR services
builder.Services.AddSignalR();

// ...

// Map SignalR hub
app.MapHub<ChatHub>("/chatHub");
```

This maps the ChatHub to the "/chatHub" endpoint, which clients connect to.

### Frontend Implementation

The Angular frontend uses the `@microsoft/signalr` package to connect to the backend hub:

#### ChatService

Located in `SignalRChat.Client/src/app/services/chat.service.ts`, this service manages the SignalR connection:

```typescript
export class ChatService {
  private hubConnection!: signalR.HubConnection;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  private connectionIdSubject = new BehaviorSubject<string | null>(null);
  public connectionId$ = this.connectionIdSubject.asObservable();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  // ... other methods
}
```

Key aspects of the service:
- Creates and manages the SignalR hub connection
- Provides observables for messages and connection status
- Handles connection lifecycle events

#### Connection Initialization

```typescript
public startConnection(): Promise<void> {
  console.log('Starting SignalR connection...');
  
  this.hubConnection = new signalR.HubConnectionBuilder()
    .withUrl('http://localhost:5289/chatHub')
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Debug)
    .build();

  this.registerSignalREvents();
  
  // ... connection event handlers

  return this.hubConnection.start().then(() => {
    const id = this.hubConnection.connectionId || null;
    console.log(`SignalR connected with ID: ${id}`);
    this.connectionIdSubject.next(id);
    this.connectionStatusSubject.next(true);
  }).catch(err => {
    console.error('Error while establishing connection: ', err);
    this.connectionStatusSubject.next(false);
    throw err;
  });
}
```

#### Event Registration

```typescript
private registerSignalREvents(): void {
  this.hubConnection.on('ReceiveMessage', (user: string, message: string) => {
    const currentMessages = this.messagesSubject.value;
    const newMessage: ChatMessage = { user, message, timestamp: new Date() };
    this.messagesSubject.next([...currentMessages, newMessage]);
  });
}
```

This registers a handler for the "ReceiveMessage" event that the server broadcasts.

#### Sending Messages

```typescript
public sendMessage(user: string, message: string): Promise<void> {
  return this.hubConnection.invoke('SendMessage', user, message);
}
```

This invokes the `SendMessage` method on the server-side hub.

## Connection Lifecycle

The application handles various connection states:

### Connection Establishment

When the Angular application loads, the `ChatComponent` initializes the connection:

```typescript
private connectToHub(): void {
  console.log('Chat component connecting to hub...');
  this.chatService.startConnection()
    .then(() => {
      console.log('Connection started successfully!');
    })
    .catch(err => {
      console.error('Error while starting connection: ', err);
    });
}
```

### Connection State Tracking

The application tracks connection state through event handlers:

```typescript
// In ChatService
this.hubConnection.onclose(() => {
  console.log('SignalR connection closed');
  this.connectionIdSubject.next(null);
  this.connectionStatusSubject.next(false);
});

this.hubConnection.onreconnecting(() => {
  console.log('SignalR reconnecting...');
  this.connectionIdSubject.next(null);
  this.connectionStatusSubject.next(false);
});

this.hubConnection.onreconnected((connectionId) => {
  console.log(`SignalR reconnected with ID: ${connectionId}`);
  this.connectionIdSubject.next(connectionId || null);
  this.connectionStatusSubject.next(true);
});
```

The `ChatComponent` subscribes to these status changes:

```typescript
private subscribeToConnectionStatus(): void {
  this.subscriptions.add(
    this.chatService.connectionStatus$.subscribe(isConnected => {
      console.log(`Connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);
      this.isConnected = isConnected;
    })
  );
}
```

## Message Broadcasting

When a user sends a message:

1. The `ChatComponent` calls `sendMessage()` on the `ChatService`
2. The service invokes the `SendMessage` method on the server hub
3. The server hub broadcasts the message to all connected clients
4. Each client receives the message via the "ReceiveMessage" event handler
5. The message is added to the messages array and displayed in the UI

## Error Handling and Reconnection

SignalR provides automatic reconnection capabilities:

```typescript
.withAutomaticReconnect()
```

This configures SignalR to automatically attempt to reconnect if the connection is lost. The application handles reconnection events through the `onreconnecting` and `onreconnected` handlers.

## CORS Configuration

For the backend to accept connections from the frontend, CORS is configured:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", builder =>
    {
        builder
            .SetIsOriginAllowed(origin => new Uri(origin).Host == "localhost")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// ...

app.UseCors("CorsPolicy");
```

This allows any localhost origin to connect to the API, which is necessary for SignalR's WebSocket connection.

## Running the Application

To run the application:

1. Start the backend API:
   ```
   cd SignalRChat.API
   dotnet run
   ```

2. Start the Angular frontend:
   ```
   cd SignalRChat.Client
   npm start
   ```

3. Navigate to the Angular application URL (typically http://localhost:4200 or another port if 4200 is in use)

4. Enter a username and start chatting in real-time with other connected users

---

This documentation provides a comprehensive overview of how SignalR is implemented in this chat application. For more detailed information about SignalR, refer to the [official Microsoft documentation](https://docs.microsoft.com/en-us/aspnet/core/signalr/introduction).
