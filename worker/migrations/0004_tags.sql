INSERT INTO tag_groups(group_key, title, position) VALUES
  ('publico', 'Público', 10),
  ('comercial', 'Comercial', 20);

INSERT INTO tags(tag_key, group_key, title, active, position) VALUES
  ('publico:idoso', 'publico', 'Idoso', 1, 10),
  ('publico:saude', 'publico', 'Saúde', 1, 20),
  ('publico:estetica', 'publico', 'Estética', 1, 30),
  ('publico:dores', 'publico', 'Dores', 1, 40),
  ('publico:corrida', 'publico', 'Corrida', 1, 50),
  ('publico:performance', 'publico', 'Performance', 1, 60),
  ('comercial:risco_de_churn', 'comercial', 'Risco de Churn', 1, 10),
  ('comercial:sem_fidelizacao', 'comercial', 'Sem fidelização', 1, 20),
  ('comercial:elohim', 'comercial', 'Elohim', 1, 30),
  ('comercial:coach', 'comercial', 'Coach', 1, 40);
