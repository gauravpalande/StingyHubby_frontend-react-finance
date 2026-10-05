import FinanceForm from '../components/FinanceForm';
import GoalSettingsForm from '../components/GoalSettingsForm';
import './UpdateFinancesPage.css';

const UpdateFinancesPage = () => {
  return (
    <div className="update-finances-page">
      <header className="update-finances-header">
        <span className="finance-section-eyebrow">YOUR MONEY, UP TO DATE</span>
        <h1>Update finances</h1>
        <p>Record a clear snapshot of your income, balances, and monthly expenses.</p>
      </header>

      <FinanceForm />

      <GoalSettingsForm />
    </div>
  );
};

export default UpdateFinancesPage;
