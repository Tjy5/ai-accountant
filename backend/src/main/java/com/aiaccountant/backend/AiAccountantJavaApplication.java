package com.aiaccountant.backend;

import com.aiaccountant.backend.config.AppProperties;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@MapperScan("com.aiaccountant.backend.mapper")
@EnableConfigurationProperties(AppProperties.class)
public class AiAccountantJavaApplication {
    public static void main(String[] args) {
        SpringApplication.run(AiAccountantJavaApplication.class, args);
    }
}
