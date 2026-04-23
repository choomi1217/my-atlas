package com.myqaweb.config.slack;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Attaches {@link SlackLogbackAppender} to the ROOT logger after Spring
 * finishes startup. We register in {@link ApplicationReadyEvent} (not at
 * bean init) so that early-startup exceptions don't flood the webhook and
 * so the notifier's dependencies are fully wired.
 *
 * If slack.webhook.url is not configured, the notifier is a no-op and the
 * appender is still attached — this keeps the filter path uniform but has
 * zero outbound cost.
 */
@Component
public class SlackAppenderRegistrar {

    private final SlackNotifierService notifier;

    public SlackAppenderRegistrar(SlackNotifierService notifier) {
        this.notifier = notifier;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void register() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();

        SlackLogbackAppender appender = new SlackLogbackAppender(notifier);
        appender.setName("SLACK");
        appender.setContext(context);
        appender.start();

        Logger rootLogger = context.getLogger(Logger.ROOT_LOGGER_NAME);
        rootLogger.addAppender(appender);
    }
}
