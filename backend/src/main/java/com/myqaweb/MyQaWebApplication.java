package com.myqaweb;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class MyQaWebApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyQaWebApplication.class, args);
    }
}
