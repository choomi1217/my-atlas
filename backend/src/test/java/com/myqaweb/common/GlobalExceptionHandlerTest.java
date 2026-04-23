package com.myqaweb.common;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void noResourceFoundReturns404NotInternalServerError() {
        NoResourceFoundException ex = new NoResourceFoundException(
                org.springframework.http.HttpMethod.GET, "actuator/env");

        ResponseEntity<ApiResponse<Void>> response = handler.handleNoResourceFound(ex);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertNotNull(response.getBody());
        assertFalse(response.getBody().success());
    }

    @Test
    void genericExceptionReturns500() {
        RuntimeException ex = new RuntimeException("boom");

        ResponseEntity<ApiResponse<Void>> response = handler.handleGeneralException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    void entityNotFoundReturns404() {
        EntityNotFoundException ex = new EntityNotFoundException("missing");

        ResponseEntity<ApiResponse<Void>> response = handler.handleEntityNotFoundException(ex);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void accessDeniedReturns403() {
        AccessDeniedException ex = new AccessDeniedException("nope");

        ResponseEntity<ApiResponse<Void>> response = handler.handleAccessDeniedException(ex);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    void illegalArgumentReturns400() {
        IllegalArgumentException ex = new IllegalArgumentException("bad");

        ResponseEntity<ApiResponse<Void>> response = handler.handleIllegalArgumentException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }
}
