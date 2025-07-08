import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpTransportType } from '@microsoft/signalr';

export interface ChatMessage {
  user: string;
  message: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private hubConnection!: signalR.HubConnection;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  private connectionIdSubject = new BehaviorSubject<string | null>(null);
  public connectionId$ = this.connectionIdSubject.asObservable();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor() { }

  public startConnection(): Promise<void> {
    console.log('Starting SignalR connection...');
    
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5289/chatHub')
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Debug) 
      .build();

    this.registerSignalREvents();
    
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

  public stopConnection(): Promise<void> {
    if (this.hubConnection) {
      this.connectionIdSubject.next(null);
      return this.hubConnection.stop();
    }
    return Promise.resolve();
  }

  public sendMessage(user: string, message: string): Promise<void> {
    return this.hubConnection.invoke('SendMessage', user, message);
  }

  private registerSignalREvents(): void {
    this.hubConnection.on('ReceiveMessage', (user: string, message: string) => {
      const currentMessages = this.messagesSubject.value;
      const newMessage: ChatMessage = {
        user,
        message,
        timestamp: new Date()
      };
      this.messagesSubject.next([...currentMessages, newMessage]);
    });

    this.hubConnection.on('UserConnected', (connectionId: string) => {
      console.log(`User connected: ${connectionId}`);
      this.connectionIdSubject.next(connectionId);
    });

    this.hubConnection.on('UserDisconnected', (connectionId: string) => {
      console.log(`User disconnected: ${connectionId}`);
    });
  }
}
