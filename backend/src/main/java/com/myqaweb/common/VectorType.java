package com.myqaweb.common;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.UserType;
import org.postgresql.util.PGobject;

import java.io.Serializable;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Arrays;

/**
 * Custom Hibernate UserType for pgvector's VECTOR column type.
 *
 * Handles the conversion between Java float[] and PostgreSQL's vector type
 * (a USER-DEFINED PGobject), which Hibernate 6's default float[] mapping
 * (FloatPrimitiveArrayJavaType / ArrayJdbcType) cannot handle.
 */
public class VectorType implements UserType<float[]> {

    @Override
    public int getSqlType() {
        return Types.OTHER;
    }

    @Override
    public Class<float[]> returnedClass() {
        return float[].class;
    }

    @Override
    public float[] nullSafeGet(ResultSet rs, int position,
                                SharedSessionContractImplementor session,
                                Object owner) throws SQLException {
        Object obj = rs.getObject(position);
        if (obj == null) {
            return null;
        }
        if (obj instanceof PGobject pgObj) {
            return parseVectorString(pgObj.getValue());
        }
        return null;
    }

    @Override
    public void nullSafeSet(PreparedStatement st, float[] value, int index,
                             SharedSessionContractImplementor session) throws SQLException {
        if (value == null) {
            st.setNull(index, Types.OTHER);
        } else {
            PGobject pgObj = new PGobject();
            pgObj.setType("vector");
            pgObj.setValue(toVectorString(value));
            st.setObject(index, pgObj);
        }
    }

    @Override
    public boolean equals(float[] x, float[] y) {
        return Arrays.equals(x, y);
    }

    @Override
    public int hashCode(float[] x) {
        return Arrays.hashCode(x);
    }

    @Override
    public float[] deepCopy(float[] value) {
        if (value == null) return null;
        return Arrays.copyOf(value, value.length);
    }

    @Override
    public boolean isMutable() {
        return true;
    }

    @Override
    public Serializable disassemble(float[] value) {
        return deepCopy(value);
    }

    @Override
    public float[] assemble(Serializable cached, Object owner) {
        if (cached == null) return null;
        return deepCopy((float[]) cached);
    }

    private float[] parseVectorString(String s) {
        if (s == null || s.length() < 2) return new float[0];
        s = s.substring(1, s.length() - 1);
        String[] parts = s.split(",");
        float[] result = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Float.parseFloat(parts[i].trim());
        }
        return result;
    }

    private String toVectorString(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(v[i]);
        }
        sb.append("]");
        return sb.toString();
    }
}
