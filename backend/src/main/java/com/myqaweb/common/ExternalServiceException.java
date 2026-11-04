package com.myqaweb.common;

/**
 * 외부 연동(Notion·Jira) 실패 또는 미설정 (HTTP 502).
 */
public class ExternalServiceException extends RuntimeException {

    public ExternalServiceException(String message) {
        super(message);
    }
}
