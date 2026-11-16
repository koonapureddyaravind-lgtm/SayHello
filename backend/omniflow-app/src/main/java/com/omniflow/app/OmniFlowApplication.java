package com.omniflow.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.omniflow")
@EntityScan(basePackages = "com.omniflow")
@EnableJpaRepositories(basePackages = "com.omniflow")
@EnableScheduling
public class OmniFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(OmniFlowApplication.class, args);
    }
}
