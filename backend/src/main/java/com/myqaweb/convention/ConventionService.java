package com.myqaweb.convention;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ConventionService {
    public List<String> findAll() {
        return List.of("Convention placeholder");
    }
}
