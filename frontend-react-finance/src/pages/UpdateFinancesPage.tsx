import FinanceForm from '../components/FinanceForm';
import './UpdateFinancesPage.css';

const UpdateFinancesPage = () => {
  return (
    <div className="update-finances-page">
      <header className="update-finances-header">
        <span className="finance-section-eyebrow">YOUR MONEY, UP TO DATE</span>
        <h1>Update finances</h1>
        <p>Update your financial snapshot and savings goals, then save them together.</p>
      </header>

      <FinanceForm />

    </div>
  );
};

export default UpdateFinancesPage;
