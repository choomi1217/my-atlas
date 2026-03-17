package com.myqaweb.senior;

import org.springframework.stereotype.Service;

@Service
public class SeniorService {

    // TODO: inject org.springframework.ai.chat.client.ChatClient
    public String chat(String userMessage) {
        // Placeholder — replace with ChatClient call
        return "Hello from My Senior! You said: " + userMessage;
    }
}
