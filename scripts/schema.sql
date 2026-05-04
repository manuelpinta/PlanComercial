-- Ejecutar en tu instancia MySQL antes del primer despliegue.
CREATE TABLE IF NOT EXISTS planes_comerciales (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_id VARCHAR(128) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plan_id (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
