import { Component, OnDestroy, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { Subscription } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {
  chatForm!: FormGroup;
  messages: ChatMessage[] = [];
  username = '';
  isConnected = false;
  private subscriptions = new Subscription();

  constructor(
    private chatService: ChatService,
    private fb: FormBuilder,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.connectToHub();
    this.subscribeToMessages();
    this.subscribeToConnectionStatus();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Only stop connection if we're in browser environment
    if (isPlatformBrowser(this.platformId)) {
      this.chatService.stopConnection();
    }
  }

  private initForm(): void {
    this.chatForm = this.fb.group({
      username: ['', [Validators.required]],
      message: ['', [Validators.required]]
    });

    if (isPlatformBrowser(this.platformId)) {
      const savedUsername = localStorage.getItem('chat_username');
      if (savedUsername) {
        this.chatForm.get('username')?.setValue(savedUsername);
        this.username = savedUsername;
      }
    }
  }

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
  
  private subscribeToConnectionStatus(): void {
    this.subscriptions.add(
      this.chatService.connectionStatus$.subscribe(isConnected => {
        console.log(`Connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);
        this.isConnected = isConnected;
      })
    );
  }

  private subscribeToMessages(): void {
    this.subscriptions.add(
      this.chatService.messages$.subscribe(messages => {
        this.messages = messages;
        
        
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            const chatContainer = document.querySelector('.chat-messages');
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }, 100);
        }
      })
    );
  }

  sendMessage(): void {
    if (this.chatForm.valid) {
      const username = this.chatForm.get('username')?.value;
      const message = this.chatForm.get('message')?.value;
      
      if (this.username !== username) {
        this.username = username;
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('chat_username', username);
        }
      }

      this.chatService.sendMessage(username, message)
        .then(() => {
          this.chatForm.get('message')?.reset();
        })
        .catch(err => console.error('Error sending message: ', err));
    }
  }

  getMessageClasses(message: ChatMessage): any {
    return {
      'my-message': message.user === this.username,
      'other-message': message.user !== this.username
    };
  }
}
