module expense {
    abstract type Base {
        annotation description := "Add 'create_at' and 'update_at' properties to all types.";
        property created_at -> datetime {
            readonly := true;
            default := datetime_current();
        };
        property updated_at -> datetime {
            readonly := true;
            default := datetime_current();
        }
    };

    type Expense extending Base {
        required property date -> datetime;
        required property amount -> decimal {
            constraint min_value(0);
        };
        property comment -> str {
            constraint min_len_value(3);
            constraint max_len_value(256);
        };
        required link category -> ExpenseCategory;
        required link place -> ExpensePlace;
    };

    type ExpenseCategory extending Base {
        required property type -> str {
            constraint min_len_value(3);
            constraint max_len_value(64);
        };
        required property name -> str {
            constraint exclusive;
            constraint min_len_value(3);
            constraint max_len_value(64);
        };
        property description -> str {
            constraint min_len_value(3);
            constraint max_len_value(256);
        };
        required property status -> str {
            constraint min_len_value(3);
            constraint max_len_value(32);
        };
        multi link expenses := (.<category[is Expense]);
    };

    type ExpensePlace extending Base {
        required property name -> str {
            constraint exclusive;
            constraint min_len_value(3);
            constraint max_len_value(64);
        };
        property description -> str {
            constraint min_len_value(3);
            constraint max_len_value(256);
        };
        required property status -> str {
            constraint min_len_value(3);
            constraint max_len_value(32);
        };
        multi link expenses := (.<place[is Expense]);
    };
}
