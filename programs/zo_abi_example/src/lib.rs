use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use zo::{self, cpi::accounts::*, program::ZoAbi as Zo, *};

declare_id!("Eg8fBwr5N3P9HTUZsKJ5LZP3jVRgBJcrnvAcY35G5rTw");

#[program]
pub mod zo_abi_example {
    use super::*;

    pub fn do_create_margin(cx: Context<DoCreateMargin>, zo_margin_nonce: u8) -> ProgramResult {
        msg!("Calling create_margin.rs through CPI");

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = cpi::accounts::CreateMargin {
            state: cx.accounts.zo_program_state.to_account_info(),
            payer: cx.accounts.authority.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            rent: cx.accounts.rent.to_account_info(),
            system_program: cx.accounts.system_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::create_margin(cpi_cx, zo_margin_nonce)?;
        Ok(())
    }

    pub fn do_deposit(cx: Context<DoDeposit>, amount: u64) -> ProgramResult {
        msg!("Calling deposit.rs through CPI with amount {}", amount);

        msg!(
            "state_signer {}",
            cx.accounts.state_signer.to_account_info().key()
        );

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = cpi::accounts::Deposit {
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            cache: cx.accounts.cache.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            token_account: cx.accounts.token_account.to_account_info(),
            vault: cx.accounts.zo_program_vault.to_account_info(),
            token_program: cx.accounts.token_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::deposit(cpi_cx, false, amount)?;
        Ok(())
    }
    pub fn do_withdraw(cx: Context<DoWithdraw>, amount: u64) -> ProgramResult {
        msg!("Calling withdraw.rs through CPI with amount {}", amount);

        msg!("{}", cx.accounts.zo_program_state.to_account_info().key());
        msg!(
            "state_signer {}",
            cx.accounts.state_signer.to_account_info().key()
        );

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = cpi::accounts::Withdraw {
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            cache: cx.accounts.cache.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            token_account: cx.accounts.token_account.to_account_info(),
            vault: cx.accounts.zo_program_vault.to_account_info(),
            token_program: cx.accounts.token_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::withdraw(cpi_cx, false, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(zo_margin_nonce: u8)]
pub struct DoCreateMargin<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub zo_program_state: AccountInfo<'info>,
    #[account(mut)]
    pub zo_program_margin: UncheckedAccount<'info>,
    pub zo_program: Program<'info, Zo>,
    #[account(mut)]
    pub control: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DoDeposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    pub zo_program_margin: AccountLoader<'info, Margin>,
    pub zo_program: Program<'info, Zo>,
    #[account(mut)]
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, address = zo_program_state.load()?.cache)]
    pub cache: AccountLoader<'info, Cache>,
    #[account(
        mut,
        constraint = {token_account.owner == *authority.key},
        constraint = token_account.amount >= amount,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub zo_program_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DoWithdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    pub zo_program_margin: AccountLoader<'info, Margin>,
    pub zo_program: Program<'info, Zo>,
    #[account(mut)]
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, address = zo_program_state.load()?.cache)]
    pub cache: AccountLoader<'info, Cache>,
    #[account(mut, address = zo_program_margin.load()?.control)]
    pub control: AccountLoader<'info, Control>,
    #[account(
        mut,
        constraint = {token_account.owner == *authority.key},
        constraint = token_account.amount >= amount,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub zo_program_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
