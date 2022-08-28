CREATE MIGRATION m16w7j2laz5h3mwujgbexs2mhdy26jcrubfv2edur436h6nc5c5s2q
    ONTO initial
{
  CREATE MODULE expense IF NOT EXISTS;
  CREATE ABSTRACT TYPE expense::Base {
      CREATE ANNOTATION std::description := "Add 'create_at' and 'update_at' properties to all types.";
      CREATE PROPERTY created_at -> std::datetime {
          SET default := (std::datetime_current());
          SET readonly := true;
      };
      CREATE PROPERTY updated_at -> std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE REQUIRED PROPERTY user_id -> std::uuid;
  };
  CREATE ABSTRACT TYPE expense::ExpenseProperty {
      CREATE PROPERTY description -> std::str {
          CREATE CONSTRAINT std::max_len_value(256);
          CREATE CONSTRAINT std::min_len_value(3);
      };
      CREATE REQUIRED PROPERTY name -> std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::max_len_value(64);
          CREATE CONSTRAINT std::min_len_value(3);
      };
      CREATE REQUIRED PROPERTY status -> std::str {
          CREATE CONSTRAINT std::max_len_value(32);
          CREATE CONSTRAINT std::min_len_value(3);
      };
  };
  CREATE TYPE expense::ExpenseCategory EXTENDING expense::Base, expense::ExpenseProperty {
      CREATE REQUIRED PROPERTY type -> std::str {
          CREATE CONSTRAINT std::max_len_value(64);
          CREATE CONSTRAINT std::min_len_value(3);
      };
  };
  CREATE TYPE expense::ExpensePlace EXTENDING expense::Base, expense::ExpenseProperty;
  CREATE TYPE expense::Expense EXTENDING expense::Base {
      CREATE REQUIRED LINK category -> expense::ExpenseCategory;
      CREATE REQUIRED LINK place -> expense::ExpensePlace;
      CREATE REQUIRED PROPERTY amount -> std::decimal {
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY comment -> std::str {
          CREATE CONSTRAINT std::max_len_value(256);
          CREATE CONSTRAINT std::min_len_value(3);
      };
      CREATE REQUIRED PROPERTY datetime -> std::datetime;
  };
};
