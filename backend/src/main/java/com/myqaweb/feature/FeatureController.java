package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/features")
public class FeatureController {

    private final FeatureService featureService;

    public FeatureController(FeatureService featureService) {
        this.featureService = featureService;
    }

    @GetMapping
    public ApiResponse<List<String>> list() {
        return ApiResponse.ok(featureService.findAll());
    }
}
