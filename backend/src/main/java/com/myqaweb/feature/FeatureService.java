package com.myqaweb.feature;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class FeatureService {
    public List<String> findAll() {
        return List.of("Feature placeholder");
    }
}
