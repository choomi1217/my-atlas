package com.myqaweb.feature;

import com.pgvector.PGvector;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA AttributeConverter to convert between float[] and PGvector.
 */
@Converter(autoApply = true)
public class FloatArrayToVectorConverter implements AttributeConverter<float[], PGvector> {

    @Override
    public PGvector convertToDatabaseColumn(float[] attribute) {
        if (attribute == null) {
            return null;
        }
        return new PGvector(attribute);
    }

    @Override
    public float[] convertToEntityAttribute(PGvector dbData) {
        if (dbData == null) {
            return null;
        }
        return dbData.toArray();
    }
}
