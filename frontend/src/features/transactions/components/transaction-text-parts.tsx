import { DeletedAccountName } from './deleted-account-name';
import { isDeletedAccount, type TransactionText } from './transaction-view';

type TransactionTextPartsProps = Readonly<{ text: TransactionText }>;

export function TransactionTextParts({ text }: TransactionTextPartsProps) {
  return text.map((part) => {
    if (typeof part === 'string') {
      return part;
    }

    if (isDeletedAccount(part)) {
      return <DeletedAccountName key={part.id} name={part.name} />;
    }

    return part.name;
  });
}
