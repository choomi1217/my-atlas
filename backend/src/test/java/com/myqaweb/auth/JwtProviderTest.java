package com.myqaweb.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for JwtProvider.
 * Uses real JWT generation/parsing (no mocks).
 */
class JwtProviderTest {

    private static final String SECRET = "test-secret-key-for-unit-tests-only-32bytes-long!!";
    private static final long EXPIRATION_MS = 86400000L; // 24 hours

    private JwtProvider jwtProvider;

    @BeforeEach
    void setUp() {
        jwtProvider = new JwtProvider(SECRET, EXPIRATION_MS);
    }

    // --- generateToken ---

    @Test
    void generateToken_returnsNonNullString() {
        // Act
        String token = jwtProvider.generateToken("admin", Role.ADMIN);

        // Assert
        assertNotNull(token);
        assertFalse(token.isBlank());
    }

    @Test
    void generateToken_returnsDifferentTokensForDifferentUsers() {
        // Act
        String token1 = jwtProvider.generateToken("admin", Role.ADMIN);
        String token2 = jwtProvider.generateToken("user", Role.USER);

        // Assert
        assertNotEquals(token1, token2);
    }

    // --- getUsername ---

    @Test
    void getUsername_extractsCorrectUsername() {
        // Arrange
        String token = jwtProvider.generateToken("admin", Role.ADMIN);

        // Act
        String username = jwtProvider.getUsername(token);

        // Assert
        assertEquals("admin", username);
    }

    @Test
    void getUsername_worksForUserRole() {
        // Arrange
        String token = jwtProvider.generateToken("testuser", Role.USER);

        // Act
        String username = jwtProvider.getUsername(token);

        // Assert
        assertEquals("testuser", username);
    }

    // --- getRole ---

    @Test
    void getRole_extractsAdminRole() {
        // Arrange
        String token = jwtProvider.generateToken("admin", Role.ADMIN);

        // Act
        String role = jwtProvider.getRole(token);

        // Assert
        assertEquals("ADMIN", role);
    }

    @Test
    void getRole_extractsUserRole() {
        // Arrange
        String token = jwtProvider.generateToken("testuser", Role.USER);

        // Act
        String role = jwtProvider.getRole(token);

        // Assert
        assertEquals("USER", role);
    }

    // --- validateToken ---

    @Test
    void validateToken_returnsTrueForValidToken() {
        // Arrange
        String token = jwtProvider.generateToken("admin", Role.ADMIN);

        // Act
        boolean valid = jwtProvider.validateToken(token);

        // Assert
        assertTrue(valid);
    }

    @Test
    void validateToken_returnsFalseForTamperedToken() {
        // Arrange
        String token = jwtProvider.generateToken("admin", Role.ADMIN);
        String tampered = token.substring(0, token.length() - 5) + "XXXXX";

        // Act
        boolean valid = jwtProvider.validateToken(tampered);

        // Assert
        assertFalse(valid);
    }

    @Test
    void validateToken_returnsFalseForRandomString() {
        // Act
        boolean valid = jwtProvider.validateToken("not-a-jwt-token");

        // Assert
        assertFalse(valid);
    }

    @Test
    void validateToken_returnsFalseForEmptyString() {
        // Act
        boolean valid = jwtProvider.validateToken("");

        // Assert
        assertFalse(valid);
    }

    @Test
    void validateToken_returnsFalseForExpiredToken() {
        // Arrange: create provider with 0ms expiration (already expired upon creation)
        JwtProvider shortLivedProvider = new JwtProvider(SECRET, 0L);
        String token = shortLivedProvider.generateToken("admin", Role.ADMIN);

        // Act
        boolean valid = shortLivedProvider.validateToken(token);

        // Assert
        assertFalse(valid);
    }

    @Test
    void validateToken_returnsFalseForTokenSignedWithDifferentSecret() {
        // Arrange: generate token with a different secret
        JwtProvider otherProvider = new JwtProvider(
                "another-secret-key-at-least-32-bytes-long!!", EXPIRATION_MS);
        String token = otherProvider.generateToken("admin", Role.ADMIN);

        // Act: validate with the main provider (different secret)
        boolean valid = jwtProvider.validateToken(token);

        // Assert
        assertFalse(valid);
    }
}
