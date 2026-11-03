package com.myqaweb.common;

/**
 * 현재 상태와 충돌하는 요청 (HTTP 409). 예: 같은 Phase의 대기·실행 중 Job과 TC가 겹침.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
