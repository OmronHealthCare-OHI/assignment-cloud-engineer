# Predictable table name, available even before your aws_dynamodb_table
# resource exists — grab it with `terraform output -raw table_name` to point
# a manual smoke test at the right table. See infrastructure/README.md.
output "table_name" {
  value       = module.label.id
  description = "Expected name of the measurements table, from the naming module."
}
