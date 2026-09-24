import FinanceForm from '../components/FinanceForm';
import GoalSettingsForm from '../components/GoalSettingsForm';

const UpdateFinancesPage = () => {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <section aria-labelledby="finance-update-heading">
        <h2 id="finance-update-heading">Update Finances</h2>
        <FinanceForm />
      </section>

      <div style={{ borderTop: '1px solid #d1d5db', marginTop: 40, paddingTop: 24 }}>
        <GoalSettingsForm />
      </div>
    </div>
  );
};

export default UpdateFinancesPage;
