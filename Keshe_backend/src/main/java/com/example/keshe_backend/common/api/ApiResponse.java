package com.example.keshe_backend.common.api;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ApiResponse<T> {

    private boolean success;
    private T data;
    private Integer errorCode;
    private String message;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, 0, "success");
    }

    public static ApiResponse<Void> success() {
        return new ApiResponse<>(true, null, 0, "success");
    }

    public static <T> ApiResponse<T> fail(Integer errorCode, String message) {
        return new ApiResponse<>(false, null, errorCode, message);
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(false, null, errorCode.getCode(), message);
    }
}