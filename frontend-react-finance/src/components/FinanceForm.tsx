import React from 'react'
import { useForm } from 'react-hook-form'
import type { FormData } from '../types/formTypes.ts'

const FinanceForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>()

  const onSubmit = (data: FormData) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px 24px', alignItems: 'center', marginBottom: '24px' }}>
        <label htmlFor="emergency" style={{ fontWeight: 'bold' }}>Emergency:</label>
        <div>
          <input id="emergency" {...register('emergency', { required: true })} />
          {errors.emergency && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>

        <label htmlFor="health" style={{ fontWeight: 'bold' }}>Health:</label>
        <div>
          <input id="health" {...register('health', { required: true })} />
          {errors.health && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>

        <label htmlFor="retirement" style={{ fontWeight: 'bold' }}>Retirement:</label>
        <div>
          <input id="retirement" {...register('retirement', { required: true })} />
          {errors.retirement && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>

        <label htmlFor="creditCards" style={{ fontWeight: 'bold' }}>Credit Cards:</label>
        <div>
          <input id="creditCards" {...register('creditCards', { required: true })} />
          {errors.creditCards && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>

        <label htmlFor="mortgage" style={{ fontWeight: 'bold' }}>Mortgage:</label>
        <div>
          <input id="mortgage" {...register('mortgage', { required: true })} />
          {errors.mortgage && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>

        <label htmlFor="carPayments" style={{ fontWeight: 'bold' }}>Car Payments:</label>
        <div>
          <input id="carPayments" {...register('carPayments', { required: true })} />
          {errors.carPayments && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>

        <label htmlFor="utilities" style={{ fontWeight: 'bold' }}>Utilities:</label>
        <div>
          <input id="utilities" {...register('utilities', { required: true })} />
          {errors.utilities && <span style={{ color: 'red', marginLeft: 8 }}>This field is required</span>}
        </div>
      </div>
      <button type="submit">Submit</button>
    </form>
  )
}

export default FinanceForm