package com.myqaweb.config.slack;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.StackTraceElementProxy;
import ch.qos.logback.core.AppenderBase;

/**
 * Logback appender that forwards ERROR-level events to SlackNotifierService.
 *
 * This appender is attached to the ROOT logger at application startup by
 * {@link SlackAppenderRegistrar}. Anything lower than ERROR is filtered out
 * in-process before reaching the notifier to minimize overhead.
 *
 * Note: the notifier itself must not emit ERROR logs on its failure path,
 * or it would cause a feedback loop through this appender.
 */
public class SlackLogbackAppender extends AppenderBase<ILoggingEvent> {

    private final SlackNotifierService notifier;

    public SlackLogbackAppender(SlackNotifierService notifier) {
        this.notifier = notifier;
    }

    @Override
    protected void append(ILoggingEvent event) {
        if (event == null || event.getLevel() == null) {
            return;
        }
        if (!event.getLevel().equals(Level.ERROR)) {
            return;
        }
        String stackTrace = renderStackTrace(event.getThrowableProxy());
        notifier.notify(event.getLoggerName(), event.getFormattedMessage(), stackTrace);
    }

    private String renderStackTrace(IThrowableProxy tp) {
        if (tp == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append(tp.getClassName());
        if (tp.getMessage() != null) {
            sb.append(": ").append(tp.getMessage());
        }
        for (StackTraceElementProxy frame : tp.getStackTraceElementProxyArray()) {
            sb.append('\n').append(frame.toString());
            if (sb.length() > SlackNotifierService.STACK_TRACE_MAX) {
                break;
            }
        }
        return sb.toString();
    }
}
