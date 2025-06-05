-- =============================================
-- SISTEMA DE DETECCIÓN DE FRAUDE
-- Script de creación de base de datos PostgreSQL
-- =============================================

-- Crear extensión para UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLA: clients (Clientes)
-- =============================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(2) DEFAULT 'GT',
    date_of_birth DATE,
    identification_number VARCHAR(50) UNIQUE NOT NULL,
    risk_profile VARCHAR(20) DEFAULT 'low' CHECK (risk_profile IN ('low', 'medium', 'high')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para clients
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_risk_profile ON clients(risk_profile);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

-- =============================================
-- TABLA: cards (Tarjetas)
-- =============================================
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    card_number_hash VARCHAR(255) NOT NULL,
    card_number_masked VARCHAR(19) NOT NULL,
    last_four_digits VARCHAR(4) NOT NULL,
    card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('credit', 'debit')),
    bank VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    credit_limit DECIMAL(12, 2),
    is_active BOOLEAN DEFAULT true,
    blocked_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para cards
CREATE INDEX IF NOT EXISTS idx_cards_client_id ON cards(client_id);
CREATE INDEX IF NOT EXISTS idx_cards_is_active ON cards(is_active);
CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);

-- =============================================
-- TABLA: transactions (Transacciones)
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    merchant_name VARCHAR(255) NOT NULL,
    merchant_type VARCHAR(50) NOT NULL,
    location TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    country VARCHAR(2) DEFAULT 'GT',
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('online', 'physical', 'atm')),
    device_info TEXT,
    ip_address INET,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para transactions
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_type ON transactions(merchant_type);
CREATE INDEX IF NOT EXISTS idx_transactions_country ON transactions(country);
CREATE INDEX IF NOT EXISTS idx_transactions_channel ON transactions(channel);

-- =============================================
-- TABLA: fraud_logs (Registros de análisis de fraude)
-- =============================================
CREATE TABLE IF NOT EXISTS fraud_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    fraud_score DECIMAL(5, 4) NOT NULL CHECK (fraud_score >= 0 AND fraud_score <= 1),
    fraud_detected BOOLEAN NOT NULL,
    analysis_details JSONB,
    layer1_results JSONB,
    layer2_results JSONB,
    layer3_results JSONB,
    final_decision JSONB,
    processing_time_ms INTEGER,
    network_versions JSONB,
    human_reviewed BOOLEAN DEFAULT false,
    reviewer_notes TEXT,
    corrected_score DECIMAL(5, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para fraud_logs
CREATE INDEX IF NOT EXISTS idx_fraud_logs_transaction_id ON fraud_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_fraud_detected ON fraud_logs(fraud_detected);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_fraud_score ON fraud_logs(fraud_score);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at ON fraud_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_human_reviewed ON fraud_logs(human_reviewed);

-- =============================================
-- TABLA: users (Usuarios del sistema)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'agent', 'risk_analyst', 'developer', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- =============================================
-- TABLA: api_keys (Claves API para integraciones)
-- =============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- =============================================
-- TABLA: training_data (Datos de entrenamiento)
-- =============================================
CREATE TABLE IF NOT EXISTS training_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_data JSONB NOT NULL,
    fraud_label BOOLEAN NOT NULL,
    fraud_score DECIMAL(5, 4),
    is_validated BOOLEAN DEFAULT false,
    used_for_training BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para training_data
CREATE INDEX IF NOT EXISTS idx_training_data_fraud_label ON training_data(fraud_label);
CREATE INDEX IF NOT EXISTS idx_training_data_is_validated ON training_data(is_validated);
CREATE INDEX IF NOT EXISTS idx_training_data_used_for_training ON training_data(used_for_training);

-- =============================================
-- TABLA: system_logs (Logs del sistema)
-- =============================================
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
    service VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para system_logs
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);

-- =============================================
-- TABLA: notification_logs (Registro de notificaciones)
-- =============================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp', 'email', 'sms', 'push')),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    fraud_log_id UUID REFERENCES fraud_logs(id) ON DELETE SET NULL,
    metadata JSONB,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_fraud_log_id ON notification_logs(fraud_log_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

-- =============================================
-- FUNCIONES TRIGGER para updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- TRIGGERS para actualizar updated_at
-- =============================================
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fraud_logs_updated_at BEFORE UPDATE ON fraud_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista de transacciones con información completa
CREATE OR REPLACE VIEW v_transaction_details AS
SELECT 
    t.id,
    t.amount,
    t.merchant_name,
    t.merchant_type,
    t.location,
    t.country,
    t.channel,
    t.created_at,
    c.first_name || ' ' || c.last_name as client_name,
    c.email as client_email,
    c.risk_profile as client_risk_profile,
    card.card_number_masked,
    card.card_type,
    card.bank,
    fl.fraud_score,
    fl.fraud_detected,
    fl.processing_time_ms
FROM transactions t
INNER JOIN clients c ON t.client_id = c.id
INNER JOIN cards card ON t.card_id = card.id
LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id;

-- Vista de estadísticas de cliente
CREATE OR REPLACE VIEW v_client_stats AS
SELECT 
    c.id,
    c.first_name || ' ' || c.last_name as full_name,
    c.risk_profile,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT card.id) as total_cards,
    COALESCE(SUM(t.amount), 0) as total_spent,
    COALESCE(AVG(t.amount), 0) as avg_transaction_amount,
    COUNT(DISTINCT t.country) as countries_visited,
    COUNT(DISTINCT t.merchant_type) as merchant_types_used,
    COUNT(CASE WHEN fl.fraud_detected = true THEN 1 END) as fraud_incidents,
    MAX(t.created_at) as last_transaction_date
FROM clients c
LEFT JOIN cards card ON c.id = card.client_id
LEFT JOIN transactions t ON c.id = t.client_id
LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
GROUP BY c.id, c.first_name, c.last_name, c.risk_profile;

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Insertar usuario administrador por defecto
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
    'admin@fraudsystem.com',
    '$2b$10$YourHashedPasswordHere', -- Cambiar por hash real de 'admin123'
    'System',
    'Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- =============================================
-- COMENTARIOS EN TABLAS
-- =============================================
COMMENT ON TABLE clients IS 'Información de clientes del sistema bancario';
COMMENT ON TABLE cards IS 'Tarjetas de crédito/débito asociadas a clientes';
COMMENT ON TABLE transactions IS 'Registro de todas las transacciones procesadas';
COMMENT ON TABLE fraud_logs IS 'Resultados del análisis de fraude por IA';
COMMENT ON TABLE users IS 'Usuarios del sistema de detección de fraude';
COMMENT ON TABLE training_data IS 'Datos para entrenamiento de redes neuronales';
COMMENT ON TABLE system_logs IS 'Logs de auditoría y sistema';
COMMENT ON TABLE notification_logs IS 'Registro de notificaciones enviadas';