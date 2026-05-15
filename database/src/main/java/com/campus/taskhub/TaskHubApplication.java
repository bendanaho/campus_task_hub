package com.campus.taskhub;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@MapperScan("com.campus.taskhub.mapper")
@SpringBootApplication
public class TaskHubApplication {

	public static void main(String[] args) {
		SpringApplication.run(TaskHubApplication.class, args);
	}
}