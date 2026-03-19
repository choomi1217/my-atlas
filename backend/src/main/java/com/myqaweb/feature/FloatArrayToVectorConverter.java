package com.myqaweb.feature;

import com.pgvector.PGvector;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.sql.SQLException;

/**
 * JPA AttributeConverter to convert between float[] and PostgreSQL vector type.
 *
 * Converts float[] to String representation (e.g., "[0.1,0.2,...]") so JDBC sends it as text.
 * PostgreSQL automatically casts text to vector type via implicit casting.
 * This avoids the "bytea" serialization error that occurs when returning PGvector directly.
 */
@Converter(autoApply = true)
public class FloatArrayToVectorConverter implements AttributeConverter<float[], String> {

    @Override
    public String convertToDatabaseColumn(float[] attribute) {
        if (attribute == null) {
            return null;
        }
        return new PGvector(attribute).toString();
    }

    @Override
    public float[] convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        try {
            return new PGvector(dbData).toArray();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to parse vector from database: " + dbData, e);
        }
    }
}
