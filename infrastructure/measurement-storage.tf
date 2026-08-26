# ── YOUR TABLE DESIGN GOES HERE ──
#
# DynamoDB is the given storage. Designing the table for the access patterns is
# the heart of deliverable element 2: the key schema, the attributes, any
# indexes — and whether it is one table or several — are your design. It must
# serve the retrieval query in openapi.yaml.
#
# Naming and tags come from the pre-filled label module in main.tf.
#
# Uncomment and complete (billing_mode is a given — keep it on-demand):
#
# resource "aws_dynamodb_table" "measurements" {
#   name         = module.label.id
#   billing_mode = "PAY_PER_REQUEST"
#
#   hash_key  = "" # your partition key
#   # range_key = "" # your sort key, if you use one
#
#   attribute {
#     name = ""
#     type = "S"
#   }
#
#   # global_secondary_index { ... } # if your access patterns need one
#
#   tags = module.label.tags
# }
