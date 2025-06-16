import ExpenseBreakdownChart from '../components/ExpenseBreakdownChart';

const UpdateFinancesPage = () => {
  return (
    <div>
      <h2>Breakdown Expenses</h2>
      <ExpenseBreakdownChart data={[]} />
    </div>
  );
};

export default UpdateFinancesPage;
