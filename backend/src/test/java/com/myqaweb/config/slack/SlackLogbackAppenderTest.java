package com.myqaweb.config.slack;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SlackLogbackAppenderTest {

    private SlackNotifierService notifier;
    private SlackLogbackAppender appender;

    @BeforeEach
    void setUp() {
        notifier = mock(SlackNotifierService.class);
        appender = new SlackLogbackAppender(notifier);
        appender.start();
    }

    @Test
    void forwardsErrorLevel() {
        ILoggingEvent event = mock(ILoggingEvent.class);
        when(event.getLevel()).thenReturn(Level.ERROR);
        when(event.getLoggerName()).thenReturn("com.example.Foo");
        when(event.getFormattedMessage()).thenReturn("boom");
        when(event.getThrowableProxy()).thenReturn(null);

        appender.doAppend(event);

        verify(notifier).notify(eq("com.example.Foo"), eq("boom"), eq(""));
    }

    @Test
    void suppressesWarnLevel() {
        ILoggingEvent event = mock(ILoggingEvent.class);
        when(event.getLevel()).thenReturn(Level.WARN);

        appender.doAppend(event);

        verifyNoInteractions(notifier);
    }

    @Test
    void suppressesInfoLevel() {
        ILoggingEvent event = mock(ILoggingEvent.class);
        when(event.getLevel()).thenReturn(Level.INFO);

        appender.doAppend(event);

        verifyNoInteractions(notifier);
    }

    @Test
    void suppressesDebugLevel() {
        ILoggingEvent event = mock(ILoggingEvent.class);
        when(event.getLevel()).thenReturn(Level.DEBUG);

        appender.doAppend(event);

        verifyNoInteractions(notifier);
    }

    @Test
    void rendersThrowableIntoStackTrace() {
        RuntimeException cause = new RuntimeException("underlying");
        ILoggingEvent event = mock(ILoggingEvent.class);
        when(event.getLevel()).thenReturn(Level.ERROR);
        when(event.getLoggerName()).thenReturn("logger");
        when(event.getFormattedMessage()).thenReturn("msg");
        when(event.getThrowableProxy()).thenReturn(new ThrowableProxy(cause));

        appender.doAppend(event);

        verify(notifier).notify(eq("logger"), eq("msg"),
                argThat(s -> s != null
                        && s.contains("RuntimeException")
                        && s.contains("underlying")));
    }

    @Test
    void tolerantOfNullEvent() {
        appender.doAppend(null);
        verifyNoInteractions(notifier);
    }
}
