package com.myqaweb.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.postgresql.util.PGobject;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for VectorType — custom Hibernate UserType for pgvector VECTOR columns.
 * Tests the public contract: nullSafeGet, nullSafeSet, equals, hashCode, deepCopy,
 * isMutable, disassemble, assemble, getSqlType, returnedClass.
 */
@ExtendWith(MockitoExtension.class)
class VectorTypeTest {

    @Mock
    private ResultSet resultSet;

    @Mock
    private PreparedStatement preparedStatement;

    @Mock
    private SharedSessionContractImplementor session;

    private VectorType vectorType;

    @BeforeEach
    void setUp() {
        vectorType = new VectorType();
    }

    // --- getSqlType ---

    @Test
    void getSqlType_returnsOther() {
        // Act & Assert
        assertEquals(Types.OTHER, vectorType.getSqlType());
    }

    // --- returnedClass ---

    @Test
    void returnedClass_returnsFloatArray() {
        // Act & Assert
        assertEquals(float[].class, vectorType.returnedClass());
    }

    // --- nullSafeGet ---

    @Test
    void nullSafeGet_returnsNullWhenResultSetObjectIsNull() throws SQLException {
        // Arrange
        when(resultSet.getObject(1)).thenReturn(null);

        // Act
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNull(result);
    }

    @Test
    void nullSafeGet_parsesPGobjectToFloatArray() throws SQLException {
        // Arrange
        PGobject pgObj = new PGobject();
        pgObj.setType("vector");
        pgObj.setValue("[0.1,0.2,0.3]");
        when(resultSet.getObject(1)).thenReturn(pgObj);

        // Act
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNotNull(result);
        assertEquals(3, result.length);
        assertEquals(0.1f, result[0], 0.001f);
        assertEquals(0.2f, result[1], 0.001f);
        assertEquals(0.3f, result[2], 0.001f);
    }

    @Test
    void nullSafeGet_handlesSingleElement() throws SQLException {
        // Arrange
        PGobject pgObj = new PGobject();
        pgObj.setType("vector");
        pgObj.setValue("[1.5]");
        when(resultSet.getObject(1)).thenReturn(pgObj);

        // Act
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.length);
        assertEquals(1.5f, result[0], 0.001f);
    }

    @Test
    void nullSafeGet_handlesNegativeValues() throws SQLException {
        // Arrange
        PGobject pgObj = new PGobject();
        pgObj.setType("vector");
        pgObj.setValue("[-0.5,0.0,1.0]");
        when(resultSet.getObject(1)).thenReturn(pgObj);

        // Act
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNotNull(result);
        assertEquals(3, result.length);
        assertEquals(-0.5f, result[0], 0.001f);
        assertEquals(0.0f, result[1], 0.001f);
        assertEquals(1.0f, result[2], 0.001f);
    }

    @Test
    void nullSafeGet_returnsNullForNonPGobject() throws SQLException {
        // Arrange — an unexpected object type from ResultSet
        when(resultSet.getObject(1)).thenReturn("not a PGobject");

        // Act
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNull(result);
    }

    @Test
    void nullSafeGet_handlesWhitespaceInVector() throws SQLException {
        // Arrange
        PGobject pgObj = new PGobject();
        pgObj.setType("vector");
        pgObj.setValue("[0.1, 0.2, 0.3]");
        when(resultSet.getObject(1)).thenReturn(pgObj);

        // Act
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNotNull(result);
        assertEquals(3, result.length);
        assertEquals(0.1f, result[0], 0.001f);
        assertEquals(0.2f, result[1], 0.001f);
        assertEquals(0.3f, result[2], 0.001f);
    }

    // --- nullSafeSet ---

    @Test
    void nullSafeSet_setsNullWhenValueIsNull() throws SQLException {
        // Act
        vectorType.nullSafeSet(preparedStatement, null, 1, session);

        // Assert
        verify(preparedStatement).setNull(1, Types.OTHER);
        verify(preparedStatement, never()).setObject(anyInt(), any());
    }

    @Test
    void nullSafeSet_setsPGobjectWithVectorString() throws SQLException {
        // Arrange
        float[] value = {0.1f, 0.2f, 0.3f};

        // Act
        vectorType.nullSafeSet(preparedStatement, value, 1, session);

        // Assert
        verify(preparedStatement, never()).setNull(anyInt(), anyInt());
        verify(preparedStatement).setObject(eq(1), argThat(obj -> {
            if (!(obj instanceof PGobject pgObj)) return false;
            return "vector".equals(pgObj.getType())
                    && "[0.1,0.2,0.3]".equals(pgObj.getValue());
        }));
    }

    @Test
    void nullSafeSet_handlesEmptyArray() throws SQLException {
        // Arrange
        float[] value = {};

        // Act
        vectorType.nullSafeSet(preparedStatement, value, 1, session);

        // Assert
        verify(preparedStatement).setObject(eq(1), argThat(obj -> {
            if (!(obj instanceof PGobject pgObj)) return false;
            return "vector".equals(pgObj.getType())
                    && "[]".equals(pgObj.getValue());
        }));
    }

    @Test
    void nullSafeSet_handlesSingleElement() throws SQLException {
        // Arrange
        float[] value = {1.5f};

        // Act
        vectorType.nullSafeSet(preparedStatement, value, 1, session);

        // Assert
        verify(preparedStatement).setObject(eq(1), argThat(obj -> {
            if (!(obj instanceof PGobject pgObj)) return false;
            return "vector".equals(pgObj.getType())
                    && "[1.5]".equals(pgObj.getValue());
        }));
    }

    // --- equals ---

    @Test
    void equals_returnsTrueForIdenticalArrays() {
        // Arrange
        float[] a = {0.1f, 0.2f, 0.3f};
        float[] b = {0.1f, 0.2f, 0.3f};

        // Act & Assert
        assertTrue(vectorType.equals(a, b));
    }

    @Test
    void equals_returnsFalseForDifferentArrays() {
        // Arrange
        float[] a = {0.1f, 0.2f, 0.3f};
        float[] b = {0.4f, 0.5f, 0.6f};

        // Act & Assert
        assertFalse(vectorType.equals(a, b));
    }

    @Test
    void equals_returnsTrueForBothNull() {
        // Act & Assert
        assertTrue(vectorType.equals(null, null));
    }

    @Test
    void equals_returnsFalseWhenOneIsNull() {
        // Arrange
        float[] a = {0.1f};

        // Act & Assert
        assertFalse(vectorType.equals(a, null));
        assertFalse(vectorType.equals(null, a));
    }

    @Test
    void equals_returnsFalseForDifferentLengths() {
        // Arrange
        float[] a = {0.1f, 0.2f};
        float[] b = {0.1f, 0.2f, 0.3f};

        // Act & Assert
        assertFalse(vectorType.equals(a, b));
    }

    // --- hashCode ---

    @Test
    void hashCode_sameForEqualArrays() {
        // Arrange
        float[] a = {0.1f, 0.2f, 0.3f};
        float[] b = {0.1f, 0.2f, 0.3f};

        // Act & Assert
        assertEquals(vectorType.hashCode(a), vectorType.hashCode(b));
    }

    @Test
    void hashCode_differsByContent() {
        // Arrange
        float[] a = {0.1f, 0.2f, 0.3f};
        float[] b = {0.4f, 0.5f, 0.6f};

        // Act & Assert — not strictly required by contract, but extremely likely
        assertNotEquals(vectorType.hashCode(a), vectorType.hashCode(b));
    }

    // --- deepCopy ---

    @Test
    void deepCopy_returnsNullForNull() {
        // Act & Assert
        assertNull(vectorType.deepCopy(null));
    }

    @Test
    void deepCopy_returnsNewArray() {
        // Arrange
        float[] original = {0.1f, 0.2f, 0.3f};

        // Act
        float[] copy = vectorType.deepCopy(original);

        // Assert
        assertArrayEquals(original, copy, 0.001f);
        assertNotSame(original, copy, "deepCopy should return a new array instance");
    }

    @Test
    void deepCopy_isolatesMutations() {
        // Arrange
        float[] original = {0.1f, 0.2f, 0.3f};

        // Act
        float[] copy = vectorType.deepCopy(original);
        copy[0] = 99.0f;

        // Assert — original should be unaffected
        assertEquals(0.1f, original[0], 0.001f);
    }

    // --- isMutable ---

    @Test
    void isMutable_returnsTrue() {
        // Act & Assert
        assertTrue(vectorType.isMutable());
    }

    // --- disassemble ---

    @Test
    void disassemble_returnsDeepCopy() {
        // Arrange
        float[] value = {0.1f, 0.2f, 0.3f};

        // Act
        float[] result = (float[]) vectorType.disassemble(value);

        // Assert
        assertArrayEquals(value, result, 0.001f);
        assertNotSame(value, result, "disassemble should return a deep copy");
    }

    @Test
    void disassemble_returnsNullForNull() {
        // Act & Assert
        assertNull(vectorType.disassemble(null));
    }

    // --- assemble ---

    @Test
    void assemble_returnsDeepCopy() {
        // Arrange
        float[] cached = {0.1f, 0.2f, 0.3f};

        // Act
        float[] result = vectorType.assemble(cached, null);

        // Assert
        assertArrayEquals(cached, result, 0.001f);
        assertNotSame(cached, result, "assemble should return a deep copy");
    }

    @Test
    void assemble_returnsNullForNull() {
        // Act & Assert
        assertNull(vectorType.assemble(null, null));
    }

    // --- roundtrip: nullSafeSet → nullSafeGet ---

    @Test
    void roundtrip_setThenGet_preservesValues() throws SQLException {
        // Arrange
        float[] original = {0.1f, -0.5f, 1.0f, 0.0f};

        // Capture what nullSafeSet writes
        vectorType.nullSafeSet(preparedStatement, original, 1, session);
        verify(preparedStatement).setObject(eq(1), argThat(obj -> {
            if (!(obj instanceof PGobject pgObj)) return false;

            // Simulate reading the same PGobject back via nullSafeGet
            try {
                when(resultSet.getObject(1)).thenReturn(pgObj);
            } catch (SQLException e) {
                throw new RuntimeException(e);
            }
            return true;
        }));

        // Act — read it back
        float[] result = vectorType.nullSafeGet(resultSet, 1, session, null);

        // Assert
        assertNotNull(result);
        assertArrayEquals(original, result, 0.001f);
    }
}
