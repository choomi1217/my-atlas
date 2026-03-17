package com.myqaweb.convention;

import com.myqaweb.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conventions")
public class ConventionController {

    private final ConventionService conventionService;

    public ConventionController(ConventionService conventionService) {
        this.conventionService = conventionService;
    }

    @GetMapping
    public ApiResponse<List<String>> list() {
        return ApiResponse.ok(conventionService.findAll());
    }
}
