using LiquidGlassDock.Glass;
using Microsoft.UI.Xaml.Controls;

namespace LiquidGlassDock.Controls;

public sealed partial class SettingsPanel : UserControl
{
    public SettingsPanel()
    {
        InitializeComponent();
    }

    /// <summary>把参数对象挂到 DataContext，供 {Binding} 双向绑定。</summary>
    public void Bind(LiquidGlassParameters parameters)
    {
        Root.DataContext = parameters;
    }
}
