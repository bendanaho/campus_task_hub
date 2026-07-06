package com.example.keshe_backend.report.repository;

import com.example.keshe_backend.report.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    List<Report> findByStatus(String status);

    List<Report> findByPostIdAndStatus(Long postId, String status);

    boolean existsByPostIdAndReporterIdAndStatus(Long postId, Long reporterId, String status);
}
