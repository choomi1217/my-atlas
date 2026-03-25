package com.myqaweb.config;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.FileAppender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.Arrays;
import java.util.Iterator;

@Component
public class LogSessionBanner {

    private static final Logger log = LoggerFactory.getLogger(LogSessionBanner.class);
    private static final int MAX_SESSION_LOGS = 30;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        printLogFilePath();
        cleanupOldLogs();
    }

    private void printLogFilePath() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        ch.qos.logback.classic.Logger rootLogger =
                context.getLogger(ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME);

        Iterator<Appender<ILoggingEvent>> it = rootLogger.iteratorForAppenders();
        while (it.hasNext()) {
            Appender<ILoggingEvent> appender = it.next();
            if (appender instanceof FileAppender<ILoggingEvent> fileAppender) {
                String containerPath = fileAppender.getFile();
                String fileName = new File(containerPath).getName();
                log.info("========================================");
                log.info("Session log: {}", containerPath);
                log.info(" -> Host path: ./logs/{}", fileName);
                log.info("========================================");
                return;
            }
        }
    }

    private void cleanupOldLogs() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        ch.qos.logback.classic.Logger rootLogger =
                context.getLogger(ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME);

        Iterator<Appender<ILoggingEvent>> it = rootLogger.iteratorForAppenders();
        while (it.hasNext()) {
            Appender<ILoggingEvent> appender = it.next();
            if (appender instanceof FileAppender<ILoggingEvent> fileAppender) {
                File logDir = new File(fileAppender.getFile()).getParentFile();
                deleteOldSessionLogs(logDir);
                return;
            }
        }
    }

    private void deleteOldSessionLogs(File logDir) {
        try {
            File[] logFiles = logDir.listFiles((dir, name) ->
                    name.startsWith("backend_") && name.endsWith(".log"));

            if (logFiles == null || logFiles.length <= MAX_SESSION_LOGS) {
                return;
            }

            Arrays.sort(logFiles);
            int toDelete = logFiles.length - MAX_SESSION_LOGS;
            for (int i = 0; i < toDelete; i++) {
                if (logFiles[i].delete()) {
                    log.info("Deleted old session log: {}", logFiles[i].getName());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to clean up old session logs", e);
        }
    }
}
