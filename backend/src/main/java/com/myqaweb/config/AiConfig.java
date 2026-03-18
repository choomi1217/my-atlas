package com.myqaweb.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Configuration for Spring AI integration.
 * Creates a ChatClient bean and designates Anthropic as the primary ChatModel.
 */
@Configuration
public class AiConfig {

    /**
     * Make Anthropic ChatModel the primary choice for autowiring.
     * Spring AI auto-configures both 'anthropicChatModel' and 'openAiChatModel' beans.
     * By marking Anthropic as @Primary, Spring will use it when resolving ChatModel dependencies.
     *
     * @param anthropicChatModel the Anthropic ChatModel bean (auto-configured by spring-ai-anthropic)
     * @return the Anthropic ChatModel, now marked as @Primary
     */
    @Bean
    @Primary
    public ChatModel primaryChatModel(@Qualifier("anthropicChatModel") ChatModel anthropicChatModel) {
        return anthropicChatModel;
    }

    /**
     * Create ChatClient bean.
     * Spring AI only auto-configures ChatClient.Builder; the actual ChatClient must be created here.
     * With primaryChatModel marked @Primary, Spring will use Anthropic when ChatClient.Builder
     * needs to resolve the ChatModel dependency.
     *
     * @param builder the ChatClient.Builder auto-configured by Spring AI
     * @return a ready-to-use ChatClient
     */
    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build();
    }
}
